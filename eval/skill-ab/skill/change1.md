### Write-side structure (1): author the connective tissue

When two parts of the graph relate only **through an intermediate concept**,
create that intermediate as its own node and wire the cross-cluster `related`
edges to it — rather than leaving the two ends unconnected, or forcing a fake
direct edge between them. These **bridge nodes** carry the multi-hop payload: a
reader (and the retriever's traversal) reaches B from A by stepping through the
bridge. When you add or revise a node, ask: *"what does this connect to that
isn't already linked — and is there a missing middle concept between them?"* —
then model the real intermediate. Don't fabricate a direct A–B edge to paper
over a missing bridge; model the actual path. A graph that only links the
obvious near-neighbors loses exactly the cross-region connections that make it
worth more than a flat list.
