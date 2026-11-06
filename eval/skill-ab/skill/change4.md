### Write-side structure (4): optimize for TRUTH, not the retriever (anti-hairball)

Optimize the graph to be a **truthful map of the domain**, not to game the
retriever. A faithful graph — real concepts, real intermediates, real
relationships — is *already* the retrieval-optimal one, because retrieval rides
on genuine structure. So:

- **Do NOT add edges "to help search."** A phantom edge that doesn't reflect a
  real relationship corrupts both the artifact and retrieval precision. An
  over-connected **hairball** has high coverage but near-zero precision — every
  pack drags in half the graph and the reader drowns in irrelevance.
- **Add the connection when it's real; omit it when it isn't.** Connectivity is a
  *consequence* of modeling the domain honestly, never a target to maximize.
- The bridge-node rule (1) and the neighbor-naming rule (2) are about modeling
  real structure faithfully — they are **not** licence to over-connect. If adding
  a node or edge doesn't make the map more *true*, it makes it worse.
