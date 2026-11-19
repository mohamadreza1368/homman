/**
 * Generates an instructional briefing for external autonomous AI agents connecting
 * to the HOOMAAN anatomical 3D control bridge via MCP or local Windows Named Pipes.
 */
export function agentBriefing(pipe: string, server: string | null): string {
  const name = pipe.replace(/^\\\\\.\\pipe\\/, "");

  const serverPath = server
    ? `${server}\\atlas.py`
    : "tools/hoomaan_mcp/atlas.py (in the HOOMAAN source)";

  return `You are driving HOOMAAN, a 3D anatomy atlas already running on this
computer. It offers twenty tools: five that read the atlas and fifteen that move
what is on screen. The control bridge switch is on, or you would not have been
given this.

BEST — configure the MCP server and restart your client.
  server: ${serverPath}
  env:    {"HOOMAAN_BRIDGE": "1"}
It needs Python 3.10+ and one package. Build an environment of your own — do
not install anything into the application's folder:
  python -m venv <somewhere>/mcpenv
  <somewhere>/mcpenv/Scripts/python -m pip install "mcp>=2.1,<3"
The tools then arrive typed, validated and documented, you can SEARCH for
structure identifiers, and you never touch the wire format. Read INSTALLED.md
beside the server for the rest.

OTHERWISE — write to the named pipe. This needs no Python at all.
  full path:  ${pipe}
  pipe name:  ${name}

The Windows API takes the NAME, not the path. Passing the full path fails in a
way that looks like the bridge being down.

  $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(
      '.', '${name}', [System.IO.Pipes.PipeDirection]::Out)
  $pipe.Connect(5000)
  $writer = New-Object System.IO.StreamWriter(
      $pipe, (New-Object System.Text.UTF8Encoding $false))
  $writer.AutoFlush = $true
  $writer.WriteLine('{"type":"scene_command","command":{"action":"say","text":"hello"}}')
  $writer.Dispose(); $pipe.Dispose()

One JSON object per line, UTF-8, at most 64 KB per line. Useful actions:
  {"action":"say","text":"..."}                      up to 4000 characters
  {"action":"focus_organ","organ_id":"..."}
  {"action":"isolate_structures","organ_ids":["...","..."]}
  {"action":"illuminate_structures","organ_ids":["..."]}
  {"action":"reset_view"}
The bridge stamps its own request_id and drops every field it does not model,
so sending one of your own has no effect.

WHAT WILL SURPRISE YOU OTHERWISE
- One client at a time. If an MCP client already holds the pipe, your
  connection is refused — which reads exactly like the switch being off.
- A command naming a structure that is not loaded is accepted and does nothing
  on screen. That is not an error, and not evidence the structure is absent:
  the reader can switch whole systems off.
- Identifiers are not guessable, and there is no way to search over the pipe.
  Ask the reader, or take the MCP route above, which can search. Inventing one
  produces a command that is accepted and does nothing.
- Your text appears in a separate lane marked "via the control bridge". It is
  not the HOOMAAN assistant, it is not saved, and it is never sent to the
  reader's AI provider. Write accordingly.`;
}
