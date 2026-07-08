// ============================================================
// data.js — Data Models, CRUD, Persistence & Sample Data
// ============================================================

const TimetableData = (() => {
  // ---- Internal State ----
  let branches = [];
  let subjects = [];
  let teachers = [];
  let sections = [];
  let rooms = [];
  let curriculum = [];
  let sectionTeachers = {}; // keys: `${sectionId}|${courseCode}`, value: teacherId

  const STORAGE_KEY = 'timetable_generator_data_v5';
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const SLOTS_PER_DAY = 8; // Total visual rows (6 teaching + 2 breaks)
  const TEACHING_SLOTS = 6; // Actual schedulable slots
  const SLOT_LABELS = [
    '9:00-10:00', '10:00-11:00', 'SHORT BREAK',
    '11:30-12:30', '12:30-1:30', 'LUNCH BREAK',
    '2:30-3:30', '3:30-4:30'
  ];
  // Indices in SLOT_LABELS that are breaks (not schedulable)
  const BREAK_INDICES = new Set([2, 5]);
  const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

  // ---- ID Generator ----
  let _idCounter = 0;
  function generateId(prefix) {
    _idCounter++;
    return `${prefix}_${Date.now()}_${_idCounter}`;
  }

  // ---- BRANCH CRUD ----
  function addBranch(name, semesters = [1, 2, 3, 4, 5, 6, 7, 8], customId = null) {
    const branch = {
      id: customId || generateId('BR'),
      name: name.trim().toUpperCase(),
      semesters: [...semesters]
    };
    branches.push(branch);
    save();
    return branch;
  }

  function updateBranch(id, updates) {
    const branch = branches.find(b => b.id === id);
    if (!branch) return null;
    if (updates.name !== undefined) branch.name = updates.name.trim().toUpperCase();
    if (updates.semesters !== undefined) branch.semesters = [...updates.semesters];
    save();
    return branch;
  }

  function removeBranch(id) {
    subjects = subjects.filter(s => s.branchId !== id);
    sections = sections.filter(s => s.branchId !== id);
    branches = branches.filter(b => b.id !== id);
    save();
  }

  function getBranches() {
    return [...branches];
  }

  function getBranchById(id) {
    return branches.find(b => b.id === id) || null;
  }

  // ---- SUBJECT CRUD ----
  function addSubject(name, code, credits, branchId, semester, hasLabFlag, exactTheory, exactLab, isElective = false) {
    const subject = {
      id: generateId('SUB'),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      credits: credits,
      isLab: hasLabFlag !== undefined ? hasLabFlag : false,
      branchId: branchId,
      semester: semester,
      theorySlots: exactTheory !== undefined ? exactTheory : credits,
      labSessions: exactLab !== undefined ? exactLab : 0,
      isElective: isElective
    };
    subjects.push(subject);
    save();
    return subject;
  }

  function updateSubject(id, updates) {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return null;
    if (updates.name !== undefined) subject.name = updates.name.trim();
    if (updates.code !== undefined) subject.code = updates.code.trim().toUpperCase();
    if (updates.credits !== undefined) subject.credits = updates.credits;
    if (updates.theorySlots !== undefined) subject.theorySlots = updates.theorySlots;
    if (updates.labSessions !== undefined) subject.labSessions = updates.labSessions;
    if (updates.isElective !== undefined) subject.isElective = updates.isElective;
    save();
    return subject;
  }

  function removeSubject(id) {
    subjects = subjects.filter(s => s.id !== id);
    save();
  }

  function getSubjects() {
    return [...subjects];
  }

  function getSubjectById(id) {
    return subjects.find(s => s.id === id) || null;
  }

  function getSubjectsByBranchSem(branchId, semester) {
    return subjects.filter(s => s.branchId === branchId && s.semester === semester);
  }

  // ---- SECTION CRUD ----
  function addSection(name, branchId, semester, strength = 0, customId = null) {
    const jsonId = customId || (branchId + '_' + semester + name);
    const section = {
      id: (customId || generateId('SEC')) + '_S' + semester,
      name: name.trim().toUpperCase(),
      branchId: branchId,
      semester: semester,
      strength: strength,
      jsonId: jsonId
    };
    sections.push(section);
    save();
    return section;
  }

  function removeSection(id) {
    sections = sections.filter(s => s.id !== id);
    save();
  }

  function getSections() {
    return [...sections];
  }

  function getSectionsByBranchSem(branchId, semester) {
    return sections.filter(s => s.branchId === branchId && s.semester === semester);
  }

  // ---- TEACHER CRUD ----
  function addTeacher(name, subjectIds = [], department = '', maxClasses = 3, canTeach = []) {
    const teacher = {
      id: generateId('TCH'),
      name: name.trim(),
      subjectIds: Array.isArray(subjectIds) ? [...subjectIds] : [],
      department: department,
      maxClasses: maxClasses,
      canTeach: [...canTeach]
    };
    teachers.push(teacher);
    save();
    return teacher;
  }

  function updateTeacher(id, updates) {
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) return null;
    if (updates.name !== undefined) teacher.name = updates.name.trim();
    if (updates.department !== undefined) teacher.department = updates.department;
    if (updates.maxClasses !== undefined) teacher.maxClasses = updates.maxClasses;
    if (updates.canTeach !== undefined) teacher.canTeach = [...updates.canTeach];
    save();
    return teacher;
  }

  function removeTeacher(id) {
    teachers = teachers.filter(t => t.id !== id);
    // Remove references in section teachers
    for (const [key, tid] of Object.entries(sectionTeachers)) {
      if (tid === id) {
        delete sectionTeachers[key];
      }
    }
    save();
  }

  function getTeachers() {
    return [...teachers];
  }

  function getTeacherById(id) {
    return teachers.find(t => t.id === id) || null;
  }

  function getTeachersForSubject(subjectId) {
    const sub = getSubjectById(subjectId);
    if (!sub) return [];
    return teachers.filter(t => t.canTeach && t.canTeach.includes(sub.code));
  }

  // ---- ROOMS ----
  function getRooms() {
    return [...rooms];
  }

  function getRoomById(id) {
    return rooms.find(r => r.id === id) || null;
  }

  // ---- CURRICULUM ----
  function getCurriculum() {
    return [...curriculum];
  }

  function getCurriculumForSection(jsonId, semester) {
    return curriculum.find(curr => curr.semester === semester && curr.section_id.includes(jsonId)) || null;
  }

  // ---- SECTION TEACHER MAPPING ----
  function setSectionTeacher(sectionId, courseCode, teacherId) {
    const key = `${sectionId}|${courseCode}`;
    if (!teacherId) {
      delete sectionTeachers[key];
    } else {
      sectionTeachers[key] = teacherId;
    }
    save();
  }

  function getSectionTeacher(sectionId, courseCode) {
    return sectionTeachers[`${sectionId}|${courseCode}`] || null;
  }

  function getSectionTeachers() {
    return { ...sectionTeachers };
  }

  function assignRandomFaculty(parity) {
    sectionTeachers = {};

    const teacherClassCount = {};
    teachers.forEach(t => {
      teacherClassCount[t.id] = 0;
    });

    const activeSemesters = parity === 'even' ? [2, 4, 6, 8] : [1, 3, 5, 7];
    const activeSections = sections.filter(s => activeSemesters.includes(s.semester));

    for (const sec of activeSections) {
      const curr = getCurriculumForSection(sec.jsonId, sec.semester);
      if (!curr) continue;

      for (const course of curr.courses) {
        const courseId = course.course_id;
        const isElective = course.is_elective;

        const isSpecial = ['el', 'counselling', 'majorproject', 'placements'].includes(courseId.toLowerCase());
        if (isElective || isSpecial) {
          continue;
        }

        const eligible = teachers.filter(t => t.canTeach && t.canTeach.includes(courseId));
        if (eligible.length === 0) {
          continue;
        }

        // Prioritize teachers of the same department as the class (sec.branchId)
        const sameDept = eligible.filter(t => t.department === sec.branchId && teacherClassCount[t.id] < t.maxClasses);
        const otherDept = eligible.filter(t => t.department !== sec.branchId && teacherClassCount[t.id] < t.maxClasses);

        let selectedTeacher = null;
        if (sameDept.length > 0) {
          selectedTeacher = sameDept[Math.floor(Math.random() * sameDept.length)];
        } else if (otherDept.length > 0) {
          selectedTeacher = otherDept[Math.floor(Math.random() * otherDept.length)];
        } else {
          // Fallback: ignore maxClasses if necessary
          const backupSameDept = eligible.filter(t => t.department === sec.branchId);
          if (backupSameDept.length > 0) {
            selectedTeacher = backupSameDept[Math.floor(Math.random() * backupSameDept.length)];
          } else {
            selectedTeacher = eligible[Math.floor(Math.random() * eligible.length)];
          }
        }

        if (selectedTeacher) {
          sectionTeachers[`${sec.id}|${courseId}`] = selectedTeacher.id;
          teacherClassCount[selectedTeacher.id]++;
        }
      }
    }

    save();
  }

  // ---- PERSISTENCE ----
  function save() {
    const data = { branches, subjects, teachers, sections, rooms, curriculum, sectionTeachers, _idCounter };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      branches = data.branches || [];
      subjects = data.subjects || [];
      teachers = data.teachers || [];
      sections = data.sections || [];
      rooms = data.rooms || [];
      curriculum = data.curriculum || [];
      sectionTeachers = data.sectionTeachers || {};
      _idCounter = data._idCounter || 0;
      return true;
    } catch (e) {
      console.warn('localStorage load failed:', e);
      return false;
    }
  }

  function clearAll() {
    branches = [];
    subjects = [];
    teachers = [];
    sections = [];
    rooms = [];
    curriculum = [];
    sectionTeachers = {};
    _idCounter = 0;
    localStorage.removeItem(STORAGE_KEY);
  }

  // ---- VALIDATION ----
  function validate(parity = null) {
    const errors = [];
    const warnings = [];

    if (branches.length === 0) {
      errors.push('No branches defined. Add at least one branch.');
    }

    const activeSemesters = parity === 'even' ? [2, 4, 6, 8] : (parity === 'odd' ? [1, 3, 5, 7] : [1, 2, 3, 4, 5, 6, 7, 8]);

    const activeSections = sections.filter(s => activeSemesters.includes(s.semester));
    if (activeSections.length === 0) {
      errors.push('No sections defined for active semesters.');
    }

    activeSections.forEach(sec => {
      const branch = getBranchById(sec.branchId);
      const branchName = branch ? branch.name : sec.branchId;

      const curr = getCurriculumForSection(sec.jsonId, sec.semester);
      if (!curr) {
        warnings.push(`${branchName} Sem-${sec.semester} Sec-${sec.name}: No curriculum courses mapped.`);
        return;
      }

      let totalSlots = 0;
      curr.courses.forEach(course => {
        const courseId = course.course_id;
        const isElective = course.is_elective;
        const isSpecial = ['el', 'counselling', 'majorproject', 'placements'].includes(courseId.toLowerCase());

        if (!isElective && !isSpecial) {
          const assignedTeacherId = sectionTeachers[`${sec.id}|${courseId}`];
          if (!assignedTeacherId) {
            errors.push(`${branchName} Sem-${sec.semester} Sec-${sec.name}: Course "${courseId}" has no teacher assigned.`);
          } else {
            const teacher = getTeacherById(assignedTeacherId);
            if (!teacher) {
              errors.push(`${branchName} Sem-${sec.semester} Sec-${sec.name}: Course "${courseId}" has invalid teacher assigned.`);
            }
          }
        }

        const sub = subjects.find(s => s.code === courseId && s.branchId === sec.branchId && s.semester === sec.semester);
        if (sub) {
          totalSlots += sub.theorySlots + sub.labSessions * 2;
        }
      });

      const maxTeachingSlots = DAYS.length * TEACHING_SLOTS;
      if (totalSlots > maxTeachingSlots) {
        errors.push(
          `${branchName} Sem-${sec.semester} Sec-${sec.name}: Total required slots (${totalSlots}) exceed available ${maxTeachingSlots} slots/week.`
        );
      }
    });

    if (teachers.length === 0) {
      errors.push('No teachers defined. Add at least one teacher.');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ---- GET ALL DATA ----
  function getAllData() {
    return {
      branches: [...branches],
      subjects: [...subjects],
      teachers: [...teachers],
      sections: [...sections],
      rooms: [...rooms],
      curriculum: [...curriculum],
      sectionTeachers: { ...sectionTeachers },
      days: DAYS,
      slotsPerDay: SLOTS_PER_DAY,
      teachingSlots: TEACHING_SLOTS,
      slotLabels: SLOT_LABELS,
      breakIndices: BREAK_INDICES,
      semesters: SEMESTERS
    };
  }

  function getAllDataFiltered(parity) {
    const activeSemesters = parity === 'even' ? [2, 4, 6, 8] : [1, 3, 5, 7];

    const filteredSections = sections.filter(s => activeSemesters.includes(s.semester));
    const filteredSubjects = subjects.filter(s => activeSemesters.includes(s.semester));
    const filteredSubjectIds = new Set(filteredSubjects.map(s => s.id));

    const filteredTeachers = teachers.map(t => ({ ...t })).filter(t => t.canTeach && t.canTeach.length > 0);

    return {
      branches: [...branches],
      subjects: filteredSubjects,
      teachers: filteredTeachers,
      sections: filteredSections,
      rooms: [...rooms],
      curriculum: [...curriculum],
      sectionTeachers: { ...sectionTeachers },
      days: DAYS,
      slotsPerDay: SLOTS_PER_DAY,
      teachingSlots: TEACHING_SLOTS,
      slotLabels: SLOT_LABELS,
      breakIndices: BREAK_INDICES,
      semesters: activeSemesters
    };
  }

  // ---- SAMPLE DATA ----
  async function loadSampleData() {
    let savedSectionTeachers = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        savedSectionTeachers = data.sectionTeachers || {};
      }
    } catch (e) {
      console.warn('Failed to load saved section teachers:', e);
    }

    clearAll();

    try {
      const timestamp = Date.now();
      const [deptRes, secRes, y1Res, y2Res, y3Res, y4Res, currRes, roomsRes, facRes] = await Promise.all([
        fetch(`../departments.json?v=${timestamp}`),
        fetch(`../sections.json?v=${timestamp}`),
        fetch(`../Y1_courses.json?v=${timestamp}`),
        fetch(`../Y2_courses.json?v=${timestamp}`),
        fetch(`../Y3_courses.json?v=${timestamp}`),
        fetch(`../Y4_courses.json?v=${timestamp}`),
        fetch(`../curriculum.json?v=${timestamp}`),
        fetch(`../rooms.json?v=${timestamp}`),
        fetch(`../faculty.json?v=${timestamp}`)
      ]);

      const deptDefs = await deptRes.json();
      const secDefs = await secRes.json();
      const y1Courses = await y1Res.json();
      const y2Courses = await y2Res.json();
      const y3Courses = await y3Res.json();
      const y4Courses = await y4Res.json();
      const curriculumDefs = await currRes.json();
      const roomsDefs = await roomsRes.json();
      const facultyDefs = await facRes.json();

      curriculum = curriculumDefs;

      // 1. Create branches
      deptDefs.forEach(dept => {
        addBranch(dept.name, [1, 2, 3, 4, 5, 6, 7, 8], dept.id);
      });

      // 2. Create sections
      secDefs.forEach(sec => {
        const oddSemester = (sec.year - 1) * 2 + 1;
        const evenSemester = oddSemester + 1;
        addSection(sec.section, sec.department, oddSemester, sec.strength || 0, sec.id);
        addSection(sec.section, sec.department, evenSemester, sec.strength || 0, sec.id);
      });

      // 3. Map courses
      const courseMap = {};
      [...y1Courses, ...y2Courses, ...y3Courses, ...y4Courses].forEach(c => {
        courseMap[c.id] = c;
      });

      // 4. Create subjects based on curriculum
      curriculumDefs.forEach(curr => {
        const sem = curr.semester;
        curr.section_id.forEach(secId => {
          const secDef = secDefs.find(s => s.id === secId);
          if (!secDef) return;
          const branchId = secDef.department;

          curr.courses.forEach(course => {
            const courseId = course.course_id;
            const courseDetails = courseMap[courseId];
            if (!courseDetails) return;

            const exists = subjects.some(s => s.code === courseId && s.branchId === branchId && s.semester === sem);
            if (!exists) {
              // Read directly from JSON — no fallbacks that could override 0 values
              const theoryHours = typeof courseDetails.theory_hours === 'number' ? courseDetails.theory_hours : 0;
              const labHours = typeof courseDetails.lab_hours === 'number' ? courseDetails.lab_hours : 0;
              const hasLab = labHours > 0;
              const theorySlots = theoryHours;
              const labSessions = labHours > 0 ? Math.ceil(labHours / 2) : 0;
              // Credits read exactly from JSON — 0 stays 0, no coercion
              const credits = typeof courseDetails.credits === 'number' ? courseDetails.credits : 0;

              const newSub = {
                id: `SUB_${courseId}_${branchId}_${sem}`,
                name: courseDetails.name,
                code: courseDetails.id,
                credits: credits,
                isLab: hasLab,
                branchId: branchId,
                semester: sem,
                theorySlots: theorySlots,
                labSessions: labSessions,
                isElective: course.is_elective || false
              };
              subjects.push(newSub);
            }
          });
        });
      });

      // 5. Load rooms
      rooms = roomsDefs;

      // 6. Load teachers
      // FIXED — stable ID derived from name, survives page reloads
      facultyDefs.forEach(f => {
        const stableId = 'TCH_' + f.name.trim().toLowerCase().replace(/\s+/g, '_');
        teachers.push({
          id: stableId,
          name: f.name,
          department: f.department,
          maxClasses: f.max_classes || 3,
          canTeach: f.can_teach || [],
          subjectIds: []
        });
      });

      // 7. Restore sectionTeachers
      for (const [key, teacherId] of Object.entries(savedSectionTeachers)) {
        const [secId, courseId] = key.split('|');
        const sectionExists = sections.some(s => s.id === secId);
        const courseExists = subjects.some(s => s.code === courseId);
        const teacherExists = teachers.some(t => t.id === teacherId);
        if (sectionExists && courseExists && teacherExists) {
          sectionTeachers[key] = teacherId;
        }
      }

      save();
      console.log('Sample data loaded from JSON files successfully.');
      return true;
    } catch (e) {
      console.error('Failed to load JSON data:', e);
      return false;
    }
  }

  // ---- PUBLIC API ----
  return {
    DAYS,
    SLOTS_PER_DAY,
    TEACHING_SLOTS,
    SLOT_LABELS,
    BREAK_INDICES,
    SEMESTERS,

    addBranch, updateBranch, removeBranch, getBranches, getBranchById,
    addSubject, updateSubject, removeSubject, getSubjects, getSubjectById, getSubjectsByBranchSem,
    addSection, removeSection, getSections, getSectionsByBranchSem,
    addTeacher, updateTeacher, removeTeacher, getTeachers, getTeacherById, getTeachersForSubject,
    getRooms, getRoomById,
    getCurriculum, getCurriculumForSection,
    setSectionTeacher, getSectionTeacher, getSectionTeachers, assignRandomFaculty,
    save, load, clearAll,
    validate, getAllData, getAllDataFiltered,
    loadSampleData
  };
})();
