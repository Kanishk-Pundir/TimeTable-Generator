# University Timetable Generator: An Algorithmic Scheduling Engine

Scheduling academic curriculums is a notoriously jagged problem. It forces administrators into a combinatorial labyrinth of faculty constraints, room availabilities, and credit-hour demands. This static web application exists to unravel that exact knot. It is a client-side scheduling engine engineered entirely on browser-native HTML and JavaScript. 

No bulky backends. No fragile database schemas. Zero remote API dependencies.

The system ingests raw JSON payloads—cataloging departments, faculty distributions, and year-wise course metrics—and synthesizes collision-free schedules. A robust genetic algorithm pulses at the core of the engine, shadowed closely by a deterministic backtracking fallback. This dual-heuristic evaluator navigates staggeringly dense constraints. It anchors basket courses rigidly in time. It segregates continuous lab hours from fragmented theory modules. It mutates its way toward a mathematically optimal grid.

## Algorithmic Mechanics

We abandoned simple loop-based scheduling early on. The sheer volume of overlapping requirements demanded a probabilistic approach. The primary engine (`genetic.js`) mimics biological evolution to discover viable timetables. 

The process kicks off by seeding a massive initial population of randomized schedules. Most of these initial grids are catastrophically flawed. Teachers are double-booked. Labs are split across lunch breaks. The fitness function slices through these chaotic generations. It assigns heavy penalties for hard constraint violations—like two sections attempting to share a single physics lab—and milder deductions for soft constraints, such as suboptimal faculty idle time. 

The highest-scoring offspring survive. The engine cross-pollinates their traits. It randomly injects mutations to prevent the population from stagnating in local optima. If the genetic approach exhausts its computational runway without achieving absolute perfection, `backtracker.js` intercepts the near-perfect grid. It deterministically resolves the final stubborn conflicts, brute-forcing the remaining cells until the matrix holds flawless integrity. 

## Constraint Ecosystem

The scheduler respects a viciously strict set of academic rules, defined deeply within `constraints.js`. 

- **Basket Anchoring:** Certain core courses must span across multiple branches simultaneously. The engine locks these blocks chronologically, forcing all peripheral electives and labs to orbit around them. 
- **Credit Continuity:** A 4-credit lab is functionally distinct from a 4-credit theory subject. Theory blocks scatter across the week to maximize retention. Labs demand contiguous, uninterrupted temporal blocks. The algorithm understands this taxonomy. 
- **Faculty Exclusivity:** A single professor cannot exist in two places. The fitness evaluator instantly executes any timetable offspring attempting temporal cloning.
- **Room Saturation:** Physical geometry dictates limits. You cannot jam sixty students into a thirty-seat seminar room. The logic maps class capacities against available square footage before cementing a slot.

## Data Topography & The JSON Schema

We ripped out SQL entirely. The domain model lives purely in decoupled JSON files. `data.js` orchestrates this ingestion.

The `curriculum.json` and `departments.json` files establish the absolute bounds of the scheduling universe. They tell the system how many branches exist and what semesters are currently active. From there, the year-wise data structures (`Y1_courses.json` through `Y4_courses.json`) map specific subjects to their respective credit loads. `faculty.json` and `rooms.json` inject the physical limitations into the mix. You might spot a few Python scripts lingering in the repository. They simply validate or bootstrap these data structures and remain strictly auxiliary.

## State Persistence & Browser Mechanics

The architecture embraces total decentralization. You navigate this complexity through a multi-step wizard interface. The setup process is strictly sequential. 

You load the base curriculum. You specify the incoming sections. You let the algorithm chew on the parameters. Intermediate configurations do not fly across the web to a remote server. They nestle directly inside the browser's `localStorage`. The `app.js` controller meticulously serializes the entire institutional blueprint into your local cache. You can close the tab mid-setup. The state remains intact.

## The Visual Pipeline

The repository splits the user workflow across four distinct vistas.

- **`main.html`**: The genesis point. This configuration wizard swallows your parameters, mapping departments to sections and binding faculty to specific subject codes.
- **`generate.html`**: The computational loading bay. This is where the genetic algorithm actually spins up, churning through thousands of generations to finalize the dataset.
- **`timetable.html`**: The visual matrix. The algorithm's final output renders into an interactive, color-coded grid. 
- **`export.html`**: The extraction layer. Driven by `export.js`, this module tears down the HTML matrix and recompiles it into pristine CSV files or print-ready structural layouts.

## Launch Protocol

Modern browser security protocols purposefully throttle `fetch` requests originating from a raw `file://` pathway. You must spin up a local server to coax the JSON payloads into the client runtime. 

It takes seconds. Drop into your terminal, navigate to the project root, and execute:

```bash
python -m http.server 8000
```

VS Code's Live Server extension works just as elegantly. 

Once your local port is breathing, point your browser to `http://localhost:8000/frontend/main.html`. The configuration wizard dictates the flow from there. You will map out the academic branches, synthesize teacher placements, and fire the generator. When the dust settles, the export utility hands you your finalized matrix. 

The entire workflow is utterly self-contained. The engine computes, evaluates, and finalizes your institutional schedules deep within the confines of your local machine.
