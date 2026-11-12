"""Extract direct disease-location assertions and propose exact-label atlas matches.

Usage: python tools/build-disease-sites.py doid-source.owl uberon-source.obo
Matching is lexical and intentionally remains unreviewed; no laterality or
parent/child anatomy is inferred from a similar label.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

do_path, uberon_path = map(Path, sys.argv[1:3])
obo = uberon_path.read_text(encoding="utf-8")
anatomy = defaultdict(set)
for block in obo.split("[Term]")[1:]:
    identifier = re.search(r"^id: (UBERON:\d+)$", block, re.M)
    name = re.search(r"^name: (.+)$", block, re.M)
    if identifier and name and not re.search(r"^is_obsolete: true$", block, re.M):
        anatomy[name.group(1).casefold()].add(identifier.group(1))

models = {}
for model, filename in (("male", "manifest.json"), ("female", "manifest_female.json")):
    manifest = json.loads(Path("public/anatomy", filename).read_text(encoding="utf-8"))
    labels = defaultdict(list)
    for organ in manifest["organs"]:
        labels[organ["name_en"].strip().casefold()].append(organ["organ_id"])
    # Exactly one UBERON concept and one atlas mesh for the identical label.
    models[model] = {next(iter(anatomy[label])): [ids[0]] for label, ids in labels.items()
                     if len(ids) == 1 and len(anatomy[label]) == 1}
    # Explicitly reviewed atlas labels for paired structures. The ontology
    # identifies the organ class, not which side is affected in any patient.
    for concept, label in (("UBERON:0002113", "kidney"), ("UBERON:0000981", "femur"),
                           ("UBERON:0000979", "tibia"), ("UBERON:0000992", "ovary"),
                           ("UBERON:0000473", "testis")):
        paired = [labels[f"{label} ({side})"][0] for side in ("left", "right") if len(labels[f"{label} ({side})"]) == 1]
        if paired:
            models[model][concept] = paired

ns = {"owl": "http://www.w3.org/2002/07/owl#", "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdfs": "http://www.w3.org/2000/01/rdf-schema#"}
about = "{" + ns["rdf"] + "}about"
resource = "{" + ns["rdf"] + "}resource"
classes = {}
root = ET.parse(do_path).getroot()
for node in root.findall("owl:Class", ns):
    iri = node.get(about, "")
    if not re.fullmatch(r"http://purl.obolibrary.org/obo/DOID_\d+", iri):
        continue
    label = node.findtext("rdfs:label", default="", namespaces=ns)
    if not label or node.find("owl:deprecated", ns) is not None:
        continue
    locations = set()
    for relation in node.findall("rdfs:subClassOf/owl:Restriction", ns):
        prop = relation.find("owl:onProperty", ns)
        target = relation.find("owl:someValuesFrom", ns)
        if prop is not None and target is not None and prop.get(resource, "").endswith("/RO_0004026"):
            value = target.get(resource, "").rsplit("/", 1)[-1]
            if re.fullmatch(r"UBERON_\d+", value):
                locations.add(value.replace("_", ":"))
    identifier = iri.rsplit("/", 1)[-1].replace("_", ":")
    parents = []
    for parent in node.findall("rdfs:subClassOf", ns):
        value = parent.get(resource, "").rsplit("/", 1)[-1]
        if re.fullmatch(r"DOID_\d+", value):
            parents.append(value.replace("_", ":"))
    classes[identifier] = {"name": label, "locations": locations, "parents": parents}

def locations_for(identifier, visiting):
    if identifier in visiting or identifier not in classes:
        return {}
    node = classes[identifier]
    found = {location: identifier for location in node["locations"]}
    for parent in node["parents"]:
        for location, source in locations_for(parent, visiting | {identifier}).items():
            found.setdefault(location, source)
    return found

data = []
for identifier, node in classes.items():
    locations = locations_for(identifier, set())
    sites = [{"uberon": location, "sourceDisease": source, **{model: models[model].get(location, []) for model in models}}
             for location, source in sorted(locations.items()) if any(location in models[model] for model in models)]
    if sites:
        data.append({"id": identifier, "name": node["name"], "sites": sites})
version = root.find("owl:Ontology/owl:versionIRI", ns)
result = {"diseaseOntologyVersion": version.get(resource, "") if version is not None else "", "uberonVersion": re.search(r"^data-version: (.+)$", obo, re.M).group(1), "diseases": data}
Path("public/diseases/do-sites.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{len(data)} diseases, {sum(len(d['sites']) for d in data)} disease-location links")
