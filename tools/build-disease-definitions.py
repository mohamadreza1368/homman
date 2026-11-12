"""Extract definitions with their source identifiers from versioned ontology releases."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

mondo_path, do_path = map(Path, sys.argv[1:3])
text = mondo_path.read_text(encoding="utf-8")
release = re.search(r"^data-version: (.+)$", text, re.M)
if not release:
    raise ValueError("Missing Mondo release")
definitions = {}
for term in text.split("[Term]")[1:]:
    identifier = re.search(r"^id: (MONDO:\d+)$", term, re.M)
    definition = re.search(r'^def: "((?:\\.|[^"\\])*)" \[(.*?)\]', term, re.M)
    if not identifier or not definition or re.search(r"^is_obsolete: true$", term, re.M):
        continue
    value = re.sub(r'\\(["\\])', r'\1', definition.group(1))
    definitions[identifier.group(1)] = {"text": value, "references": definition.group(2)}

ns = {"owl": "http://www.w3.org/2002/07/owl#", "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#", "obo": "http://purl.obolibrary.org/obo/"}
about = "{" + ns["rdf"] + "}about"
resource = "{" + ns["rdf"] + "}resource"
root = ET.parse(do_path).getroot()
version = root.find("owl:Ontology/owl:versionIRI", ns)
do_release = version.get(resource, "") if version is not None else ""
for node in root.findall("owl:Class", ns):
    iri = node.get(about, "")
    if not re.fullmatch(r"http://purl.obolibrary.org/obo/DOID_\d+", iri) or node.find("owl:deprecated", ns) is not None:
        continue
    value = node.findtext("obo:IAO_0000115", default="", namespaces=ns).strip()
    if value:
        definitions[iri.rsplit("/", 1)[-1].replace("_", ":")] = {"text": value, "references": ""}
if len(definitions) < 10000:
    raise ValueError("The source appears incomplete")
output = {"mondoRelease": release.group(1), "diseaseOntologyRelease": do_release, "definitions": definitions}
Path("public/diseases/definitions.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Extracted {len(definitions)} definitions")
