// ============================================================
// backtracker.js — Deterministic Backtracking Constraint Solver
// ============================================================

const BacktrackerAlgorithm = (() => {
  let isRunning = false;
  let shouldStop = false;
  let bestResult = null;

  async function run(options, onProgress, onComplete) {
    isRunning = true;
    shouldStop = false;
    const startTime = Date.now();

    const parity = options.semesterParity || 'odd';
    const data = TimetableData.getAllDataFiltered(parity);

    // Initialize state
    const timetable = {};
    const teacherBusy = {};
    const roomBusy = {};
    const sectionBusy = {};

    // Initialize timetable grid for each section
    data.sections.forEach(sec => {
      timetable[sec.id] = Array.from({ length: data.days.length }, () => Array(data.teachingSlots).fill(null));
      sectionBusy[sec.id] = Array.from({ length: data.days.length }, () => Array(data.teachingSlots).fill(false));
    });

    // Initialize teacher busy grids
    data.teachers.forEach(t => {
      teacherBusy[t.id] = Array.from({ length: data.days.length }, () => Array(data.teachingSlots).fill(false));
    });

    // Initialize room busy grids
    data.rooms.forEach(r => {
      roomBusy[r.id] = Array.from({ length: data.days.length }, () => Array(data.teachingSlots).fill(false));
    });

    // 1. Assign consistent classrooms to each section for their theory classes
    const sectionClassrooms = {};
    const classrooms = data.rooms.filter(r => r.type === 'classroom');

    data.sections.forEach(sec => {
      const deptRooms = classrooms.filter(r => r.department === sec.branchId);
      const backupRooms = classrooms.filter(r => r.department === 'Multi');
      const allEligible = [...deptRooms, ...backupRooms, ...classrooms];

      // Assign room with least sections assigned so far
      let selectedRoom = allEligible[0];
      let minCount = Infinity;
      allEligible.forEach(r => {
        const count = Object.values(sectionClassrooms).filter(rid => rid === r.id).length;
        if (count < minCount) {
          minCount = count;
          selectedRoom = r;
        }
      });
      sectionClassrooms[sec.id] = selectedRoom ? selectedRoom.id : null;
    });

    // Helper to identify eligible lab rooms
    function getEligibleLabs(courseCode, branchId) {
      const labs = data.rooms.filter(r => r.type === 'lab');
      if (courseCode.startsWith('PH')) {
        return [...labs.filter(r => r.department === 'PHY'), ...labs.filter(r => r.department === 'Multi'), ...labs];
      }
      if (courseCode.startsWith('CH') || courseCode.startsWith('CY')) {
        return [...labs.filter(r => r.department === 'CHEM' || r.department === 'CHE'), ...labs.filter(r => r.department === 'Multi'), ...labs];
      }
      return [...labs.filter(r => r.department === branchId), ...labs.filter(r => r.department === 'Multi'), ...labs];
    }

    // 2. Build tasks list
    const tasks = [];

    // Map course_id -> is_elective
    const electiveGroupMap = {};

    data.sections.forEach(sec => {
      const curr = TimetableData.getCurriculumForSection(sec.jsonId, sec.semester);
      if (!curr) return;

      curr.courses.forEach(course => {
        if (course.is_elective) {
          const key = `${course.course_id}|${sec.semester}`;
          if (!electiveGroupMap[key]) electiveGroupMap[key] = [];
          electiveGroupMap[key].push(sec.id);
        }
      });
    });

    // Add Elective tasks (Synchronized theory + per-section lab if applicable)
    for (const [key, sectionIds] of Object.entries(electiveGroupMap)) {
      const [courseCode, sem] = key.split('|');
      const semester = parseInt(sem);

      const isUnschedulable = ['majorproject', 'placements'].includes(courseCode.toLowerCase());
      if (isUnschedulable) return;

      const subject = data.subjects.find(s => s.code === courseCode && s.semester === semester);
      if (!subject) continue;

      // Theory slots (synchronized across all sections)
      for (let i = 0; i < subject.theorySlots; i++) {
        tasks.push({
          type: 'elective',
          courseCode: courseCode,
          semester: semester,
          sections: sectionIds,
          subjectId: subject.id,
          slotsNeeded: 1
        });
      }

      // Lab slots — per section, no teacher/room for elective labs
      if (subject.labSessions > 0) {
        for (const secId of sectionIds) {
          const teacherId = data.sectionTeachers[`${secId}|${courseCode}`] || null;
          for (let i = 0; i < subject.labSessions; i++) {
            tasks.push({
              type: 'lab',
              sectionId: secId,
              courseCode: courseCode,
              teacherId: teacherId,
              subjectId: subject.id,
              duration: 2
            });
          }
        }
      }
    }

    // Add Lab tasks (non-elective, non-special)
    data.sections.forEach(sec => {
      const curr = TimetableData.getCurriculumForSection(sec.jsonId, sec.semester);
      if (!curr) return;

      curr.courses.forEach(course => {
        if (course.is_elective) return;

        const isUnschedulable = ['majorproject', 'placements'].includes(course.course_id.toLowerCase());
        if (isUnschedulable) return;

        const subject = data.subjects.find(s => s.code === course.course_id && s.branchId === sec.branchId && s.semester === sec.semester);
        if (!subject) return;

        const teacherId = data.sectionTeachers[`${sec.id}|${course.course_id}`] || null;

        for (let i = 0; i < subject.labSessions; i++) {
          tasks.push({
            type: 'lab',
            sectionId: sec.id,
            courseCode: course.course_id,
            teacherId: teacherId,
            subjectId: subject.id,
            duration: 2
          });
        }
      });
    });

    // Add Regular Theory tasks (non-elective, non-special)
    data.sections.forEach(sec => {
      const curr = TimetableData.getCurriculumForSection(sec.jsonId, sec.semester);
      if (!curr) return;

      curr.courses.forEach(course => {
        if (course.is_elective) return;

        const isUnschedulable = ['majorproject', 'placements'].includes(course.course_id.toLowerCase());
        if (isUnschedulable) return;

        const subject = data.subjects.find(s => s.code === course.course_id && s.branchId === sec.branchId && s.semester === sec.semester);
        if (!subject) return;

        const teacherId = data.sectionTeachers[`${sec.id}|${course.course_id}`] || null;

        for (let i = 0; i < subject.theorySlots; i++) {
          tasks.push({
            type: 'theory',
            sectionId: sec.id,
            courseCode: course.course_id,
            teacherId: teacherId,
            subjectId: subject.id,
            duration: 1
          });
        }
      });
    });
    // Helper functions for constraints checking
    function isElectiveSlotPossible(task, day, slot) {
      for (const secId of task.sections) {
        if (sectionBusy[secId][day][slot]) return false;
        const roomId = sectionClassrooms[secId];
        if (roomId && roomBusy[roomId][day][slot]) return false;
      }
      return true;
    }

    function isLabSlotPossible(task, day, slot, roomId) {
      if (slot + 1 >= data.teachingSlots) return false;
      if (sectionBusy[task.sectionId][day][slot] || sectionBusy[task.sectionId][day][slot + 1]) return false;
      if (task.teacherId) {
        if (teacherBusy[task.teacherId][day][slot] || teacherBusy[task.teacherId][day][slot + 1]) return false;
        if (roomBusy[roomId][day][slot] || roomBusy[roomId][day][slot + 1]) return false;
      }
      // No teacher = no room needed, only check section is free (already done above)
      return true;
    }

    function isTheorySlotPossible(task, day, slot, roomId) {
      if (sectionBusy[task.sectionId][day][slot]) return false;

      if (task.teacherId) {
        if (teacherBusy[task.teacherId][day][slot]) return false;
      }

      if (roomId && roomBusy[roomId][day][slot]) return false;

      return true;
    }

    // Forward Checking Check
    function forwardCheckValid(taskIndex) {
      for (let i = taskIndex + 1; i < tasks.length; i++) {
        const t = tasks[i];
        let hasOption = false;

        if (t.type === 'elective') {
          for (let d = 0; d < data.days.length; d++) {
            for (let s = 0; s < data.teachingSlots; s++) {
              if (isElectiveSlotPossible(t, d, s)) {
                hasOption = true;
                break;
              }
            }
            if (hasOption) break;
          }
        } else if (t.type === 'lab') {
          const eligibleLabs = getEligibleLabs(t.courseCode, data.sections.find(s => s.id === t.sectionId).branchId);
          for (let d = 0; d < data.days.length; d++) {
            for (const s of [0, 2, 4]) {
              for (const room of eligibleLabs) {
                if (isLabSlotPossible(t, d, s, room.id)) {
                  hasOption = true;
                  break;
                }
              }
              if (hasOption) break;
            }
            if (hasOption) break;
          }
        } else if (t.type === 'theory') {
          const roomId = sectionClassrooms[t.sectionId];
          for (let d = 0; d < data.days.length; d++) {
            for (let s = 0; s < data.teachingSlots; s++) {
              if (isTheorySlotPossible(t, d, s, roomId)) {
                hasOption = true;
                break;
              }
            }
            if (hasOption) break;
          }
        }

        if (!hasOption) return false;
      }
      return true;
    }

    // Placement state modifiers
    function tryPlaceElective(task, day, slot) {
      task.sections.forEach(secId => {
        const roomId = sectionClassrooms[secId];
        timetable[secId][day][slot] = {
          subjectId: task.subjectId,
          teacherId: null,
          roomId: roomId,
          type: 'theory'
        };
        sectionBusy[secId][day][slot] = true;
        if (roomId) roomBusy[roomId][day][slot] = true;
      });
      return true;
    }

    function undoPlaceElective(task, day, slot) {
      task.sections.forEach(secId => {
        const roomId = sectionClassrooms[secId];
        timetable[secId][day][slot] = null;
        sectionBusy[secId][day][slot] = false;
        if (roomId) roomBusy[roomId][day][slot] = false;
      });
    }

    function tryPlaceLab(task, day, slot, roomId) {
      const secId = task.sectionId;
      const assignedRoom = task.teacherId ? roomId : null;
      timetable[secId][day][slot] = {
        subjectId: task.subjectId,
        teacherId: task.teacherId,
        roomId: assignedRoom,
        type: 'lab'
      };
      timetable[secId][day][slot + 1] = {
        subjectId: task.subjectId,
        teacherId: task.teacherId,
        roomId: assignedRoom,
        type: 'lab_cont'
      };
      sectionBusy[secId][day][slot] = true;
      sectionBusy[secId][day][slot + 1] = true;
      if (task.teacherId) {
        teacherBusy[task.teacherId][day][slot] = true;
        teacherBusy[task.teacherId][day][slot + 1] = true;
      }
      if (assignedRoom) {
        roomBusy[assignedRoom][day][slot] = true;
        roomBusy[assignedRoom][day][slot + 1] = true;
      }
      return true;
    }

    function undoPlaceLab(task, day, slot, roomId) {
      const secId = task.sectionId;
      timetable[secId][day][slot] = null;
      timetable[secId][day][slot + 1] = null;

      sectionBusy[secId][day][slot] = false;
      sectionBusy[secId][day][slot + 1] = false;

      if (task.teacherId) {
        teacherBusy[task.teacherId][day][slot] = false;
        teacherBusy[task.teacherId][day][slot + 1] = false;
      }

      roomBusy[roomId][day][slot] = false;
      roomBusy[roomId][day][slot + 1] = false;
    }

    function tryPlaceTheory(task, day, slot, roomId) {
      const secId = task.sectionId;
      // Only assign a room if a teacher is also assigned
      const assignedRoom = task.teacherId ? roomId : null;
      timetable[secId][day][slot] = {
        subjectId: task.subjectId,
        teacherId: task.teacherId,
        roomId: assignedRoom,
        type: 'theory'
      };
      sectionBusy[secId][day][slot] = true;
      if (task.teacherId) teacherBusy[task.teacherId][day][slot] = true;
      if (assignedRoom) roomBusy[assignedRoom][day][slot] = true;
      return true;
    }

    // Backtracking Search Loop
    let stepCount = 0;
    const maxSteps = options.maxSteps || 50000;
    
    // Returns days sorted by how many classes that section already has that day
// — days with fewer classes come first, spreading load across the week
    function getDayOrderForSection(sectionId, timetable, numDays) {
      const counts = Array(numDays).fill(0);

      // Count existing assignments for this section on each day
      const grid = timetable[sectionId];
      if (grid) {
        for (let d = 0; d < numDays; d++) {
          for (let s = 0; s < grid[d].length; s++) {
            if (grid[d][s] !== null) counts[d]++;
          }
        }
      }

      // Return day indices sorted ascending by count (least loaded day first)
      return Array.from({ length: numDays }, (_, i) => i)
        .sort((a, b) => counts[a] - counts[b]);
    }

    async function solve(taskIndex) {
      for (let i = 0; i < tasks.length; i++) {
        if (shouldStop) return false;

        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          if (onProgress) onProgress(i, tasks.length, 0);
        }

        const task = tasks[i];
        let placed = false;

        if (task.type === 'elective') {
          // Spread-aware day order — try days with fewest assignments first
          const dayOrder = getDayOrderForSection(task.sections[0], timetable, data.days.length);
          outer: for (const d of dayOrder) {
            for (let s = 0; s < data.teachingSlots; s++) {
              if (isElectiveSlotPossible(task, d, s)) {
                tryPlaceElective(task, d, s);
                placed = true;
                break outer;
              }
            }
          }

        } else if (task.type === 'lab') {
          const sec = data.sections.find(s => s.id === task.sectionId);
          const dayOrder = getDayOrderForSection(task.sectionId, timetable, data.days.length);

          if (task.teacherId) {
            // Has teacher — need a real room
            const eligibleLabs = getEligibleLabs(task.courseCode, sec.branchId);
            outer: for (const d of dayOrder) {
              for (const s of [0, 2, 4]) {
                for (const room of eligibleLabs) {
                  if (isLabSlotPossible(task, d, s, room.id)) {
                    tryPlaceLab(task, d, s, room.id);
                    placed = true;
                    break outer;
                  }
                }
              }
            }
            // Fallback: any lab
            if (!placed) {
              const allLabs = data.rooms.filter(r => r.type === 'lab');
              outer2: for (let d = 0; d < data.days.length; d++) {
                for (const s of [0, 2, 4]) {
                  for (const room of allLabs) {
                    if (isLabSlotPossible(task, d, s, room.id)) {
                      tryPlaceLab(task, d, s, room.id);
                      placed = true;
                      break outer2;
                    }
                  }
                }
              }
            }
          } else {
            // No teacher (e.g. elective lab like XX115XIX) — just find free section slots
            console.log(`Placing no-teacher lab for ${task.courseCode} section ${task.sectionId}`);
            outer: for (const d of dayOrder) {
              for (const s of [0, 2, 4]) {
                const possible = isLabSlotPossible(task, d, s, null);
                console.log(`  day ${d} slot ${s}: possible=${possible}, busy0=${sectionBusy[task.sectionId][d][s]}, busy1=${sectionBusy[task.sectionId][d][s+1]}`);
                if (possible) {
                  tryPlaceLab(task, d, s, null);
                  placed = true;
                  break outer;
                }
              }
            }
            console.log(`Result for ${task.courseCode} ${task.sectionId}: placed=${placed}`);
          }
        } else if (task.type === 'theory') {
          const roomId = sectionClassrooms[task.sectionId];
          const dayOrder = getDayOrderForSection(task.sectionId, timetable, data.days.length);
          outer: for (const d of dayOrder) {
            for (let s = 0; s < data.teachingSlots; s++) {
              if (isTheorySlotPossible(task, d, s, roomId)) {
                tryPlaceTheory(task, d, s, roomId);
                placed = true;
                break outer;
              }
            }
          }
        }

        stepCount++;
        if (!placed) {
          console.warn(`Could not place task ${i}: ${task.type} ${task.courseCode || task.subjectId}`);
        }
      }

      return true;
    }
    // After all tasks are pushed, sort: labs first, then theory
    // This ensures 2-slot lab blocks are claimed before theory fills the grid
    tasks.sort((a, b) => {
      const priority = { lab: 0, elective: 1, theory: 2 };
      return (priority[a.type] ?? 2) - (priority[b.type] ?? 2);
    });
    const success = await solve(0);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Build the final result
    const hardViolations = success ? 0 : 1; // 0 if perfect, 1 if failed
    const teacherAssignment = {};

    data.sections.forEach(sec => {
      const curr = TimetableData.getCurriculumForSection(sec.jsonId, sec.semester);
      if (!curr) return;
      curr.courses.forEach(course => {
        const teacherId = data.sectionTeachers[`${sec.id}|${course.course_id}`] || null;
        const subject = data.subjects.find(s => s.code === course.course_id && s.branchId === sec.branchId && s.semester === sec.semester);
        if (subject && teacherId) {
          teacherAssignment[`${sec.id}|${subject.id}`] = teacherId;
        }
      });
    });

    bestResult = {
      timetable: timetable,
      fitness: {
        hardViolations: hardViolations,
        softPenalty: 0,
        hardDetails: success ? [] : ['Could not find a valid conflict-free timetable within the search limits.'],
        softDetails: []
      },
      elapsed: parseFloat(elapsed),
      teacherAssignment: teacherAssignment
    };

    isRunning = false;

    if (onComplete) {
      onComplete(bestResult);
    }

    return bestResult;
  }

  function stop() {
    shouldStop = true;
  }

  function getResult() {
    return bestResult;
  }

  function getIsRunning() {
    return isRunning;
  }

  return {
    run,
    stop,
    getResult,
    isRunning: getIsRunning
  };
})();

// Backwards compatibility alias
const GeneticAlgorithm = BacktrackerAlgorithm;
