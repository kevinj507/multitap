### Write-side structure (2): name a node's neighbors in its body

In a node's markdown body, **name the neighboring concepts it connects to** — the
entities, nodes, or topics on the other end of its `related` edges. This is
truthful (a faithful description of a concept mentions what it relates to) and it
lifts retrieval: those neighbor names in the body are what hybrid search matches
to surface this node as a *seed*, from which traversal reaches the rest of the
neighborhood. A node whose body never mentions its neighbors is an island to the
retriever even when the edges exist. e.g. a "power-management chips" node body
should name the datacenters, power-distribution, and grid concepts it feeds into,
not just describe the chips in isolation.
