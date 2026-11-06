### Write-side structure (3): a `related` edge is a genuine semantic link

A `related` edge should encode a **real, specific relationship** — not a loose
"these are both about the same broad topic" vibe. The edge's value is its
*selectivity*: it tells the reader (and the traversal) that *these two nodes
specifically* inform each other. Before adding a `related` edge, be able to state
the relationship in a few words — "X supplies Y", "X competes with Y", "X is the
bridge between Y and Z". If you can't name it, it's probably noise; leave it out.
A graph where everything relates to everything carries no information — the links
stop discriminating, and traversal from any seed drags in half the graph.
