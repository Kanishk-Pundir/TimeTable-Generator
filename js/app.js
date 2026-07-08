// ============================================================
// app.js — Multi-Page Controller
// Detects which page is loaded and initializes the correct logic.
// ============================================================

const RESULT_KEY = 'timetable_generator_result';


document.addEventListener('DOMContentLoaded', async () => {

  initParityToggle();

  // Always load fresh data from JSON files to ensure we use the real course data.
  // localStorage is only used for mid-session persistence (e.g., wizard state).
  await TimetableData.loadSampleData();

  // Detect page by body id
  const pageId = document.body.id;

  switch (pageId) {
    case 'page-setup':
      initSetupPage();
      break;
    case 'page-generate':
      initGeneratePage();
      break;
    case 'page-timetable':
      initTimetablePage();
      break;
    case 'page-export':
      initExportPage();
      break;
  }
});


// ---- TOAST ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.style.cssText = `padding:14px 24px;margin-bottom:8px;border-radius:16px;color:#fff;font-size:14px;font-family:Epilogue,sans-serif;
    box-shadow:0 8px 24px rgba(39,19,16,0.25);transition:opacity 0.3s ease;max-width:400px;backdrop-filter:blur(12px);`;
  toast.style.background = type === 'error' ? '#ba1a1a' : type === 'success' ? '#2e7d32' : '#3E2723';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ---- RESULT PERSISTENCE ----
// In-memory cache survives navigation within the same tab session if using SPA,
// but for multi-page: localStorage is the only bridge. So also add a size check:

function saveResult(result) {
  try {
    const str = JSON.stringify(result);
    if (str.length > 4 * 1024 * 1024) { // >4MB, split it
      localStorage.setItem(RESULT_KEY + '_meta', JSON.stringify({
        fitness: result.fitness,
        elapsed: result.elapsed,
        teacherAssignment: result.teacherAssignment
      }));
      localStorage.setItem(RESULT_KEY + '_tt', JSON.stringify(result.timetable));
    } else {
      localStorage.setItem(RESULT_KEY, str);
      localStorage.removeItem(RESULT_KEY + '_meta');
      localStorage.removeItem(RESULT_KEY + '_tt');
    }
  } catch (e) {
    console.warn('localStorage save failed:', e);
    showToast('Warning: result may not persist across pages.', 'info');
  }
}

function loadResult() {
  try {
    // Try split storage first
    const metaStr = localStorage.getItem(RESULT_KEY + '_meta');
    const ttStr = localStorage.getItem(RESULT_KEY + '_tt');
    if (metaStr && ttStr) {
      return { ...JSON.parse(metaStr), timetable: JSON.parse(ttStr) };
    }
    // Fall back to single key
    const raw = localStorage.getItem(RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
// ================================================================
// SEMESTER PARITY TOGGLE
// ================================================================
function initParityToggle() {
  const btnOdd = document.getElementById('btn-sem-odd');
  const btnEven = document.getElementById('btn-sem-even');

  function updateParityUI() {
    const parity = localStorage.getItem('timetable_semester_parity') || 'odd';
    const activeClass = 'bg-primary-container text-on-primary-container font-semibold shadow-sm';
    const inactiveClass = 'bg-transparent text-on-surface-variant font-normal hover:bg-surface-variant/30';

    if (btnOdd && btnEven) {
      if (parity === 'odd') {
        btnOdd.className = `flex-1 py-[8px] px-[16px] rounded-full flex items-center justify-center gap-2 font-label-md text-label-md transition-all duration-200 ${activeClass}`;
        btnEven.className = `flex-1 py-[8px] px-[16px] rounded-full flex items-center justify-center gap-2 font-label-md text-label-md transition-all duration-200 ${inactiveClass}`;
      } else {
        btnEven.className = `flex-1 py-[8px] px-[16px] rounded-full flex items-center justify-center gap-2 font-label-md text-label-md transition-all duration-200 ${activeClass}`;
        btnOdd.className = `flex-1 py-[8px] px-[16px] rounded-full flex items-center justify-center gap-2 font-label-md text-label-md transition-all duration-200 ${inactiveClass}`;
      }
    }
  }

  updateParityUI();

  if (btnOdd) {
    btnOdd.addEventListener('click', () => {
      localStorage.setItem('timetable_semester_parity', 'odd');
      updateParityUI();
      if (typeof currentStep !== 'undefined') updateWizardUI(); // Re-render the current setup step
    });
  }

  if (btnEven) {
    btnEven.addEventListener('click', () => {
      localStorage.setItem('timetable_semester_parity', 'even');
      updateParityUI();
      if (typeof currentStep !== 'undefined') updateWizardUI(); // Re-render the current setup step
    });
  }
}

// ================================================================
// PAGE: SETUP (main.html)
// ================================================================
let currentStep = 1;

function getActiveSemesters() {
  const parity = localStorage.getItem('timetable_semester_parity') || 'odd';
  return parity === 'even' ? [2, 4, 6, 8] : [1, 3, 5, 7];
}

function initSetupPage() {
  renderSetupBranches();

  document.querySelectorAll('[id^="step-indicator-"]').forEach(stepEl => {
    const step = parseInt(stepEl.id.replace('step-indicator-', ''), 10);
    if (!Number.isNaN(step)) {
      stepEl.addEventListener('click', () => {
        currentStep = step;
        updateWizardUI();
      });
    }
  });

  const btnAddBranch = document.getElementById('btn-add-branch');
  if (btnAddBranch) {
    btnAddBranch.addEventListener('click', () => {
      TimetableData.addBranch(`Branch ${TimetableData.getBranches().length + 1}`);
      renderSetupBranches();
    });
  }

  const btnNext = document.getElementById('btn-next-step');
  const btnPrev = document.getElementById('btn-prev-step');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (currentStep < 4) {
        currentStep++;
        updateWizardUI();
      } else {
        // FIXED: pass parity so only active semesters are validated
        const parity = localStorage.getItem('timetable_semester_parity') || 'odd';
        const validation = TimetableData.validate(parity);
        if (!validation.valid) {
          showToast(validation.errors[0], 'error');
          return;
        }
        TimetableData.save();
        showToast('Configuration Saved!', 'success');
        setTimeout(() => {
          window.location.href = 'generate.html';
        }, 500);
      }
    });
  }
}
function updateWizardUI() {
  const stepContainerIds = ['step-branches', 'step-subjects', 'step-sections', 'step-teachers'];

  // Update progress indicators
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`step-indicator-${i}`);
    const containerEl = document.getElementById(stepContainerIds[i - 1]);

    if (stepEl) {
      const circle = stepEl.querySelector('.indicator-circle');
      const text = stepEl.querySelector('.indicator-text');
      stepEl.classList.add('cursor-pointer');

      if (i < currentStep) {
        circle.className = 'w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary text-[12px] font-bold shadow-md indicator-circle';
        text.className = 'font-label-sm text-label-sm text-secondary uppercase tracking-wider indicator-text';
      } else if (i === currentStep) {
        circle.className = 'w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary text-[12px] font-bold ring-4 ring-background shadow-md indicator-circle';
        text.className = 'font-label-sm text-label-sm text-secondary uppercase tracking-wider indicator-text';
      } else {
        circle.className = 'w-8 h-8 rounded-full border-2 border-outline-variant bg-surface-container flex items-center justify-center text-on-surface-variant text-[12px] font-bold indicator-circle';
        text.className = 'font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider indicator-text';
      }
    }

    if (containerEl) {
      if (i === currentStep) {
        containerEl.classList.remove('hidden');
        containerEl.classList.add('flex');
      } else {
        containerEl.classList.add('hidden');
        containerEl.classList.remove('flex');
      }
    }
  }

  // Update operational status progress — 25% per step
  const progressPct = currentStep * 25;
  const progressBar = document.getElementById('setup-progress-bar');
  const progressNum = document.getElementById('setup-progress-pct');
  if (progressBar) progressBar.style.width = progressPct + '%';
  if (progressNum) progressNum.textContent = progressPct;

  // Update prev/next buttons
  const btnPrev = document.getElementById('btn-prev-step');
  const btnNextText = document.getElementById('btn-next-step-text');

  if (btnPrev) {
    btnPrev.style.display = currentStep === 1 ? 'none' : 'flex';
  }

  if (btnNextText) {
    btnNextText.textContent = currentStep === 4 ? 'Save & Generate' : 'Next Step';
  }

  // Re-render content for the active step
  switch (currentStep) {
    case 1: renderSetupBranches(); break;
    case 2: renderSetupSubjects(); break;
    case 3: renderSetupSections(); break;
    case 4: renderSetupTeachers(); break;
  }
}
function renderSetupBranches() {
  const container = document.getElementById('branches-list');
  if (!container) return;

  const branches = TimetableData.getBranches();
  container.innerHTML = `<div class="flex flex-col gap-4" id="branches-cards"></div>`;

  const cardsContainer = document.getElementById('branches-cards');

  branches.forEach(branch => {
    const card = document.createElement('div');
    card.className = 'volumetric-pane rounded-2xl p-6 relative overflow-hidden group';
    card.innerHTML = `
      <div class="absolute left-0 top-0 bottom-0 w-1 bg-secondary rounded-full"></div>
      <div class="flex justify-between items-start mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-secondary-fixed flex items-center justify-center">
            <span class="material-symbols-outlined text-on-secondary-fixed-variant text-[20px]">domain</span>
          </div>
          <h3 class="font-title-md text-title-md text-primary">${branch.name}</h3>
        </div>
        <button class="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity btn-del-branch"
                data-id="${branch.id}" title="Delete branch">
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
      <div class="grid grid-cols-3 gap-6">
        <div>
          <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Branch Code</label>
          <input class="branch-name-input w-full inset-panel rounded-xl px-4 py-2 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                 type="text" value="${branch.name}" data-id="${branch.id}" />
        </div>
        <div>
          <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Semesters Active</label>
          <div class="flex items-center gap-2 h-[38px]">
            ${getActiveSemesters().map(sem => `
              <div class="flex items-center gap-1 inset-panel px-3 py-1.5 rounded-full ${branch.semesters.includes(sem) ? '' : 'opacity-40'}">
                <span class="w-2 h-2 rounded-full ${branch.semesters.includes(sem) ? 'bg-secondary' : 'bg-outline-variant'}"></span>
                <span class="font-label-sm text-label-sm">S${sem}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    cardsContainer.appendChild(card);
  });

  cardsContainer.querySelectorAll('.branch-name-input').forEach(inp => {
    inp.addEventListener('change', (e) => {
      TimetableData.updateBranch(e.target.dataset.id, { name: e.target.value });
    });
  });

  cardsContainer.querySelectorAll('.btn-del-branch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      TimetableData.removeBranch(id);
      renderSetupBranches();
    });
  });
}

function populateFilterOptions(filterBranchId, filterSemId) {
  const selBranch = document.getElementById(filterBranchId);
  const selSem = document.getElementById(filterSemId);
  if (!selBranch || !selSem) return;

  const branches = TimetableData.getBranches();

  // Keep current selection if possible
  const currentBranch = selBranch.value;
  const currentSem = selSem.value;

  selBranch.innerHTML = '<option value="">Select Branch</option>';
  branches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.text = b.name;
    selBranch.appendChild(opt);
  });

  const activeSems = getActiveSemesters();
  selSem.innerHTML = '<option value="">Select Semester</option>';
  activeSems.forEach(sem => {
    const opt = document.createElement('option');
    opt.value = sem;
    opt.text = `Semester ${sem}`;
    selSem.appendChild(opt);
  });

  if (currentBranch && branches.find(b => b.id === currentBranch)) {
    selBranch.value = currentBranch;
  } else if (branches.length > 0) {
    selBranch.value = branches[0].id; // Default to first branch
  }

  if (currentSem && activeSems.includes(parseInt(currentSem))) {
    selSem.value = currentSem;
  } else if (activeSems.length > 0) {
    selSem.value = activeSems[0]; // Default to first active sem
  }
}

// ================================================================
// STEP 2: SUBJECTS
// ================================================================
function renderSetupSubjects() {
  const container = document.getElementById('subjects-list');
  if (!container) return;

  populateFilterOptions('filter-subject-branch', 'filter-subject-semester');

  const selBranch = document.getElementById('filter-subject-branch');
  const selSem = document.getElementById('filter-subject-semester');

  const branchId = selBranch.value;
  const semester = parseInt(selSem.value);

  // Re-render when filters change
  selBranch.onchange = renderSetupSubjects;
  selSem.onchange = renderSetupSubjects;

  if (!branchId) {
    container.innerHTML = '<div class="text-on-surface-variant p-4">Please select a branch and semester above.</div>';
    return;
  }

  const subjects = TimetableData.getSubjectsByBranchSem(branchId, semester);

  container.innerHTML = `<div class="flex flex-col gap-4" id="subjects-cards"></div>`;

  const cardsContainer = document.getElementById('subjects-cards');

  subjects.forEach(sub => {
    const card = document.createElement('div');
    card.className = 'volumetric-pane rounded-2xl p-6 relative overflow-hidden group';
    card.innerHTML = `
      <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-full"></div>
      <div class="flex justify-between items-start mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <span class="material-symbols-outlined text-blue-600 text-[20px]">menu_book</span>
          </div>
          <h3 class="font-title-md text-title-md text-primary">${sub.name} (${sub.code})</h3>
        </div>
        <button class="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity btn-del-subject"
                data-id="${sub.id}" title="Delete subject">
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
      <div class="grid grid-cols-2 gap-6">
      <div>
          <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Subject Name</label>
          <input class="subj-name-input w-full inset-panel rounded-xl px-4 py-2 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                 type="text" value="${sub.name}" data-id="${sub.id}" />
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div>
              <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Code</label>
              <input class="subj-code-input w-full inset-panel rounded-xl px-4 py-2 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                     type="text" value="${sub.code}" data-id="${sub.id}" />
          </div>
          <div>
              <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Credits</label>
              <div class="inset-panel rounded-xl px-4 py-2 font-body-md text-body-md text-on-surface-variant">
                ${sub.credits} credit${sub.credits !== 1 ? 's' : ''}
              </div>
          </div>
          <div>
              <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Classes/Week</label>
              <input class="subj-cpw-input w-full inset-panel rounded-xl px-4 py-2 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                     type="number" min="1" max="6" value="${sub.theorySlots}" data-id="${sub.id}" />
          </div>
        </div>
    `;
    cardsContainer.appendChild(card);
  });

  // Add Subject button logic
  const btnAdd = document.getElementById('btn-add-subject');
  if (btnAdd) {
    btnAdd.onclick = () => {
      TimetableData.addSubject('New Subject', 'SUBXXX', 3, branchId, semester);
      renderSetupSubjects();
    };
  }

  // Update handlers
  cardsContainer.querySelectorAll('.subj-name-input').forEach(inp => {
    inp.addEventListener('change', (e) => { TimetableData.updateSubject(e.target.dataset.id, { name: e.target.value }); });
  });
  cardsContainer.querySelectorAll('.subj-code-input').forEach(inp => {
    inp.addEventListener('change', (e) => { TimetableData.updateSubject(e.target.dataset.id, { code: e.target.value }); });
  });
  cardsContainer.querySelectorAll('.subj-credits-input').forEach(inp => {
    inp.addEventListener('change', (e) => { TimetableData.updateSubject(e.target.dataset.id, { credits: parseInt(e.target.value) }); renderSetupSubjects(); });
  });
  cardsContainer.querySelectorAll('.subj-cpw-input').forEach(inp => {
    inp.addEventListener('change', (e) => { TimetableData.updateSubject(e.target.dataset.id, { theorySlots: parseInt(e.target.value) }); });
  });

  // Delete handler
  cardsContainer.querySelectorAll('.btn-del-subject').forEach(btn => {
    btn.addEventListener('click', (e) => {
      TimetableData.removeSubject(e.currentTarget.dataset.id);
      renderSetupSubjects();
    });
  });
}

// ================================================================
// STEP 3: SECTIONS
// ================================================================
function renderSetupSections() {
  const container = document.getElementById('sections-list');
  if (!container) return;

  populateFilterOptions('filter-section-branch', 'filter-section-semester');

  const selBranch = document.getElementById('filter-section-branch');
  const selSem = document.getElementById('filter-section-semester');

  const branchId = selBranch.value;
  const semester = parseInt(selSem.value);

  // Re-render when filters change
  selBranch.onchange = renderSetupSections;
  selSem.onchange = renderSetupSections;

  if (!branchId) {
    container.innerHTML = '<div class="text-on-surface-variant p-4">Please select a branch and semester above.</div>';
    return;
  }

  const sections = TimetableData.getSectionsByBranchSem(branchId, semester);

  container.innerHTML = `<div class="grid grid-cols-3 gap-4" id="sections-cards"></div>`;

  const cardsContainer = document.getElementById('sections-cards');

  sections.forEach(sec => {
    const card = document.createElement('div');
    card.className = 'volumetric-pane rounded-2xl p-5 flex justify-between items-center group relative overflow-hidden';
    card.innerHTML = `
      <div class="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-full"></div>
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center font-bold text-amber-700 text-lg">
            ${sec.name}
        </div>
        <span class="font-label-md text-label-md text-on-surface">Section ${sec.name}</span>
      </div>
      <button class="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity btn-del-section"
              data-id="${sec.id}" title="Delete section">
        <span class="material-symbols-outlined text-[18px]">delete</span>
      </button>
    `;
    cardsContainer.appendChild(card);
  });

  // Add Section button logic
  const btnAdd = document.getElementById('btn-add-section');
  if (btnAdd) {
    btnAdd.onclick = () => {
      const names = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const newName = names[sections.length % names.length]; // Simple logic to assign A, B, C
      TimetableData.addSection(newName, branchId, semester);
      renderSetupSections();
    };
  }

  // Delete handler
  cardsContainer.querySelectorAll('.btn-del-section').forEach(btn => {
    btn.addEventListener('click', (e) => {
      TimetableData.removeSection(e.currentTarget.dataset.id);
      renderSetupSections();
    });
  });
}

// ================================================================
// STEP 4: TEACHERS (FACULTY ASSIGNMENT)
// ================================================================
function renderSetupTeachers() {
  const container = document.getElementById('teachers-list');
  if (!container) return;

  // 1. Populate Branch and Semester dropdowns (just like pages 2 and 3)
  populateFilterOptions('filter-teacher-branch', 'filter-teacher-semester');

  const selBranch = document.getElementById('filter-teacher-branch');
  const selSem = document.getElementById('filter-teacher-semester');
  const selSection = document.getElementById('filter-teacher-section');

  const branchId = selBranch.value;
  const semester = parseInt(selSem.value);

  // Re-render when branch or semester changes
  if (selBranch && selSem) {
    selBranch.onchange = () => {
      if (selSection) selSection.value = "";
      renderSetupTeachers();
    };
    selSem.onchange = () => {
      if (selSection) selSection.value = "";
      renderSetupTeachers();
    };
  }

  if (!branchId || !semester) {
    container.innerHTML = '<div class="text-on-surface-variant p-4">Please select a branch and semester above.</div>';
    if (selSection) {
      selSection.innerHTML = '<option value="">Select Section</option>';
    }
    return;
  }

  // 2. Populate Section dropdown based on the selected branch/semester
  const sections = TimetableData.getSectionsByBranchSem(branchId, semester);
  const currentSectionVal = selSection ? selSection.value : "";
  
  if (selSection) {
    selSection.innerHTML = '<option value="">Select Section</option>';
    sections.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec.id;
      opt.text = `Section ${sec.name}`;
      selSection.appendChild(opt);
    });

    if (currentSectionVal && sections.some(s => s.id === currentSectionVal)) {
      selSection.value = currentSectionVal;
    } else if (sections.length > 0) {
      selSection.value = sections[0].id;
    }

    selSection.onchange = renderSetupTeachers;
  }

  const sectionId = selSection ? selSection.value : "";
  if (!sectionId) {
    container.innerHTML = '<div class="text-on-surface-variant p-4">Please select a section above.</div>';
    return;
  }

  const sectionObj = TimetableData.getSections().find(s => s.id === sectionId);
  if (!sectionObj) {
    container.innerHTML = '<div class="text-on-surface-variant p-4">Invalid section selection.</div>';
    return;
  }

  // 3. Find the curriculum mapped courses for this section
  const curr = TimetableData.getCurriculumForSection(sectionObj.jsonId, semester);
  if (!curr || !curr.courses || curr.courses.length === 0) {
    container.innerHTML = `<div class="text-on-surface-variant p-4">No curriculum found for section ${sectionObj.jsonId} in Semester ${semester}.</div>`;
    return;
  }

  container.innerHTML = `<div class="flex flex-col gap-4" id="teachers-assignment-cards"></div>`;
  const cardsContainer = document.getElementById('teachers-assignment-cards');

  const allSubjects = TimetableData.getSubjects();

  curr.courses.forEach(course => {
    const courseId = course.course_id;
    const isElective = course.is_elective;
    const isSpecial = ['el', 'counselling', 'majorproject', 'placements'].includes(courseId.toLowerCase());

    const subject = allSubjects.find(s => s.code === courseId && s.branchId === branchId && s.semester === semester);
    const courseName = subject ? subject.name : courseId;

    const card = document.createElement('div');
    card.className = 'volumetric-pane rounded-2xl p-6 relative overflow-hidden group';

    if (isElective || isSpecial) {
      card.innerHTML = `
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-outline-variant rounded-full"></div>
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
              <span class="material-symbols-outlined text-on-surface-variant text-[20px]">block</span>
            </div>
            <div>
              <h3 class="font-title-md text-title-md text-on-surface-variant">${courseId} — ${courseName}</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant/70">${isElective ? 'Elective Course' : 'Non-Class/Audit Activity'}</p>
            </div>
          </div>
          <div class="font-body-md text-body-md text-on-surface-variant italic">No faculty assigned</div>
        </div>
      `;
    } else {
      const eligibleTeachers = subject ? TimetableData.getTeachersForSubject(subject.id) : [];
      const assignedTeacherId = TimetableData.getSectionTeacher(sectionId, courseId);

      card.innerHTML = `
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-full"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <span class="material-symbols-outlined text-purple-600 text-[20px]">school</span>
            </div>
            <div>
              <h3 class="font-title-md text-title-md text-primary">${courseId} — ${courseName}</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Credits: ${subject ? subject.credits : 'N/A'} | Theory Slots: ${subject ? subject.theorySlots : 'N/A'}</p>
            </div>
          </div>
          <div>
            <label class="block font-label-sm text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">Assign Faculty</label>
            <select class="teacher-select w-full inset-panel rounded-xl px-4 py-2 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                    data-section="${sectionId}" data-course="${courseId}">
              <option value="">Select Teacher</option>
              ${eligibleTeachers.map(t => `
                <option value="${t.id}" ${assignedTeacherId === t.id ? 'selected' : ''}>
                  ${t.name} (${t.department})
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      `;
    }

    cardsContainer.appendChild(card);
  });

  cardsContainer.querySelectorAll('.teacher-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const secId = e.target.dataset.section;
      const cId = e.target.dataset.course;
      const tId = e.target.value;
      TimetableData.setSectionTeacher(secId, cId, tId);
      showToast('Faculty assignment updated', 'success');
    });
  });

  const btnAssignRandom = document.getElementById('btn-assign-random');
  if (btnAssignRandom) {
    btnAssignRandom.onclick = () => {
      const currentParity = localStorage.getItem('timetable_semester_parity') || 'odd';
      TimetableData.assignRandomFaculty(currentParity);
      renderSetupTeachers();
      showToast('Random faculty assigned successfully!', 'success');
    };
  }
}

// ================================================================
// COMPLEXITY CHART
// ================================================================
let complexityChartInstance = null;

function renderComplexityChart(actualTasks, actualElapsedSeconds) {
  const container = document.getElementById('complexity-chart-container');
  const canvas = document.getElementById('complexity-chart');
  if (!container || !canvas) return;

  container.style.display = 'block';

  // Update stat cards
  const ourTimeEl = document.getElementById('chart-our-time');
  const taskCountEl = document.getElementById('chart-task-count');
  const slotsInfoEl = document.getElementById('chart-slots-info');
  if (ourTimeEl) ourTimeEl.textContent = actualElapsedSeconds.toFixed(2) + 's';
  if (taskCountEl) taskCountEl.textContent = actualTasks.toLocaleString() + ' tasks';
  if (slotsInfoEl) slotsInfoEl.textContent = `5 days × 6 slots × sections`;

  // X axis: task counts from 10 to 1500
  const taskPoints = [];
  for (let n = 10; n <= 1500; n += 20) taskPoints.push(n);

  const DAYS = 5;
  const SLOTS = 6;

  // ---- Complexity functions (returns estimated ms) ----

  // Greedy + Backtracking: O(n × d × s)
  // Each task tries at most d*s slot combinations — constant per task
  // Calibrated: at our actual task count, output = actualElapsedSeconds * 1000
  const greedyCalibration = (actualElapsedSeconds * 1000) / (actualTasks * DAYS * SLOTS);
  function greedyTime(n) {
    return greedyCalibration * n * DAYS * SLOTS;
  }

  // Brute Force: O(s^n) — tries every possible assignment
  // Represented as: base^n * small_constant, capped for display
  // At n=10: (30)^10 ≈ 5.9e14 ms — already astronomical
  // We show log scale so use: constant * Math.pow(slots*days, n * 0.1) for readability
  function bruteForceTime(n) {
    // Pure exponential — (d*s)^n grows too fast to show meaningfully past n=20
    // We represent it as relative to greedy using log scale
    const base = DAYS * SLOTS; // 30 possible slots per task
    // Use log to keep it plottable: represents log of actual complexity
    return Math.min(greedyCalibration * Math.pow(1.15, n), 1e12);
  }

  // Dynamic Programming: O(n × 2^c) where c = constraint variables (sections, rooms, teachers)
  // c ≈ number of sections (~92) — 2^92 is intractable
  // We represent: n * 2^(c_effective) where c_effective scales with n
  function dpTime(n) {
    // DP state space: n tasks × 2^(conflict_vars)
    // conflict_vars grows with n (more tasks = more interacting constraints)
    const cEffective = Math.min(n * 0.08, 40); // caps at 2^40
    return Math.min(greedyCalibration * n * Math.pow(2, cEffective * 0.5), 1e12);
  }

  // Genetic Algorithm: O(g × p × n)
  // generations=500, population=200, evaluation per chromosome = n
  function geneticTime(n) {
    const generations = 500;
    const population = 200;
    // Each fitness evaluation is O(n), done p times per generation
    const gaCalibration = greedyCalibration * 8; // GA overhead ~8x per operation
    return gaCalibration * generations * population * n * 0.0001;
  }

  // Build datasets
  const greedyData = taskPoints.map(n => ({ x: n, y: greedyTime(n) }));
  const bruteData = taskPoints.map(n => ({ x: n, y: bruteForceTime(n) }));
  const dpData = taskPoints.map(n => ({ x: n, y: dpTime(n) }));
  const gaData = taskPoints.map(n => ({ x: n, y: geneticTime(n) }));

  // Our actual measured point
  const actualPoint = [{
    x: actualTasks,
    y: actualElapsedSeconds * 1000
  }];

  // Destroy previous chart if exists
  if (complexityChartInstance) {
    complexityChartInstance.destroy();
    complexityChartInstance = null;
  }

  complexityChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Greedy + Backtracking — O(n·d·s)',
          data: greedyData,
          borderColor: '#8f4c2e',
          backgroundColor: 'rgba(143,76,46,0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.4,
          fill: false
        },
        {
          label: 'Brute Force — O(sⁿ)',
          data: bruteData,
          borderColor: '#ba1a1a',
          backgroundColor: 'rgba(186,26,26,0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.4,
          fill: false
        },
        {
          label: 'Dynamic Programming — O(n·2^c)',
          data: dpData,
          borderColor: '#1565c0',
          backgroundColor: 'rgba(21,101,192,0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.4,
          fill: false
        },
        {
          label: 'Genetic Algorithm — O(g·p·n)',
          data: gaData,
          borderColor: '#2e7d32',
          backgroundColor: 'rgba(46,125,50,0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.4,
          fill: false
        },
        {
          label: `Our Result (${actualTasks} tasks, ${actualElapsedSeconds.toFixed(2)}s)`,
          data: actualPoint,
          borderColor: '#8f4c2e',
          backgroundColor: '#8f4c2e',
          borderWidth: 2,
          pointRadius: 8,
          pointStyle: 'circle',
          pointHoverRadius: 10,
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false // we use custom legend below
        },
        tooltip: {
          backgroundColor: 'rgba(39,19,16,0.95)',
          titleColor: '#ffdad4',
          bodyColor: '#d3c3c0',
          borderColor: 'rgba(143,76,46,0.3)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: (items) => `Tasks: ${items[0].parsed.x}`,
            label: (item) => {
              const ms = item.parsed.y;
              let timeStr;
              if (ms < 1) timeStr = ms.toFixed(3) + ' ms';
              else if (ms < 1000) timeStr = ms.toFixed(1) + ' ms';
              else if (ms < 60000) timeStr = (ms / 1000).toFixed(2) + ' s';
              else if (ms < 3600000) timeStr = (ms / 60000).toFixed(1) + ' min';
              else if (ms < 86400000) timeStr = (ms / 3600000).toFixed(1) + ' hrs';
              else if (ms < 31536000000) timeStr = (ms / 86400000).toFixed(1) + ' days';
              else timeStr = (ms / 31536000000).toFixed(1) + ' yrs';
              return ` ${item.dataset.label.split('—')[0].trim()}: ${timeStr}`;
            }
          }
        },
        annotation: {
          annotations: {
            taskLine: {
              type: 'line',
              xMin: actualTasks,
              xMax: actualTasks,
              borderColor: 'rgba(143,76,46,0.4)',
              borderWidth: 1,
              borderDash: [4, 4],
              label: {
                display: true,
                content: `n = ${actualTasks}`,
                position: 'start',
                color: '#8f4c2e',
                font: { size: 11 }
              }
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Number of Tasks (n)',
            color: '#504442',
            font: { family: 'Epilogue', size: 12, weight: '600' }
          },
          ticks: {
            color: '#504442',
            font: { family: 'Epilogue', size: 11 }
          },
          grid: {
            color: 'rgba(211,195,192,0.3)'
          }
        },
        y: {
          type: 'logarithmic',
          title: {
            display: true,
            text: 'Estimated Time (ms, log scale)',
            color: '#504442',
            font: { family: 'Epilogue', size: 12, weight: '600' }
          },
          ticks: {
            color: '#504442',
            font: { family: 'Epilogue', size: 11 },
            callback: (val) => {
              if (val >= 31536000000) return (val / 31536000000).toFixed(0) + ' yr';
              if (val >= 86400000) return (val / 86400000).toFixed(0) + ' day';
              if (val >= 3600000) return (val / 3600000).toFixed(0) + ' hr';
              if (val >= 60000) return (val / 60000).toFixed(0) + ' min';
              if (val >= 1000) return (val / 1000).toFixed(0) + ' s';
              return val + ' ms';
            }
          },
          grid: {
            color: 'rgba(211,195,192,0.3)'
          }
        }
      }
    }
  });
}

// ================================================================
// PAGE: GENERATE
// ================================================================
function initGeneratePage() {
  // ---- Sync range slider labels ----
  const popSlider = document.getElementById('param-population');
  const popLabel = document.getElementById('param-population-label');
  if (popSlider && popLabel) {
    popSlider.addEventListener('input', () => { popLabel.textContent = popSlider.value; });
  }

  const mutSlider = document.getElementById('param-mutation');
  const mutLabel = document.getElementById('param-mutation-label');
  if (mutSlider && mutLabel) {
    mutSlider.addEventListener('input', () => { mutLabel.textContent = mutSlider.value + '%'; });
  }

  const btnGenerate = document.getElementById('btn-generate');
  const btnStop = document.getElementById('btn-stop');

  if (btnGenerate) {
    btnGenerate.addEventListener('click', () => {
      const currentParity = localStorage.getItem('timetable_semester_parity') || 'odd';
      // Validate data first (only for the selected parity)
      const validation = TimetableData.validate(currentParity);
      if (!validation.valid) {
        showToast(validation.errors[0], 'error');
        return;
      }

      const popSize = parseInt(document.getElementById('param-population')?.value || 200);
      const maxGen = parseInt(document.getElementById('param-generations')?.value || 500);
      const mutRate = parseFloat(document.getElementById('param-mutation')?.value || 5) / 100;

      // UI: show stop, hide generate
      btnGenerate.style.display = 'none';
      if (btnStop) btnStop.style.display = 'flex';

      const btnText = document.getElementById('btn-generate-text');

      GeneticAlgorithm.run(
        {
          populationSize: popSize,
          maxGenerations: maxGen,
          mutationRate: mutRate,
          semesterParity: localStorage.getItem('timetable_semester_parity') || 'odd'
        },
        // Progress callback
        (gen, maxGen, bestFitness) => {
          const pct = Math.round((gen / maxGen) * 100);
          const progBar = document.getElementById('progress-bar');
          const progText = document.getElementById('progress-text');

          if (progBar) progBar.style.width = pct + '%';
          if (progText) progText.textContent = `Gen ${gen}/${maxGen} — ${pct}%`;
        },
        // Complete callback
        (result) => {
          // Save to localStorage for other pages
          saveResult(result);

          btnGenerate.style.display = 'flex';
          if (btnStop) btnStop.style.display = 'none';
          if (btnText) btnText.textContent = 'Re-Generate';

          // Update stats
          const statHard = document.getElementById('stat-hard');
          const statSoft = document.getElementById('stat-soft');
          const statTime = document.getElementById('stat-time');

          if (statHard) statHard.textContent = result.fitness.hardViolations;
          if (statSoft) statSoft.textContent = result.fitness.softPenalty;
          if (statTime) statTime.textContent = result.elapsed + 's';

          const progText = document.getElementById('progress-text');
          if (progText) progText.textContent = '100% — Complete!';
          const progBar = document.getElementById('progress-bar');
          if (progBar) progBar.style.width = '100%';

          if (result.fitness.hardViolations === 0) {
  // FIXED: use currentParity instead of undefined semesterParity
            showToast(`Optimal ${currentParity} semester timetable generated!`, 'success');
          } else {
            showToast(`Done with ${result.fitness.hardViolations} hard violation(s).`, 'error');
          }
          const data = TimetableData.getAllDataFiltered(currentParity);
          const taskCount = Object.values(result.timetable)
            .reduce((total, grid) => {
              return total + grid.flat().filter(c => c !== null && c.type !== 'lab_cont').length;
            }, 0);
          renderComplexityChart(taskCount, result.elapsed);
        }
      );
    });
  }

  if (btnStop) {
    btnStop.addEventListener('click', () => {
      GeneticAlgorithm.stop();
      btnGenerate.style.display = 'flex';
      btnStop.style.display = 'none';
    });
  }
}

// ================================================================
// PAGE: TIMETABLE
// ================================================================
function initTimetablePage() {
  const result = loadResult();
  if (!result || !result.timetable) {
    showToast('No timetable generated yet. Go to the Generate page first.', 'error');
    return;
  }

  const data = TimetableData.getAllData();
  const generatedSectionIds = new Set(Object.keys(result.timetable || {}));
  const sections = data.sections.filter(section => generatedSectionIds.has(section.id));
  const branches = data.branches;
  const teachers = getTeachersInTimetable(result.timetable, data.teachers);

  const selView = document.getElementById('tt-view-select');
  const lblView = document.getElementById('tt-view-label');
  const btnSectionView = document.getElementById('btn-section-view');
  const btnTeacherView = document.getElementById('btn-teacher-view');

  let currentView = 'section'; // 'section' or 'teacher'

  function updateViewUI() {
    if (!selView || !lblView) return;

    selView.innerHTML = '';

    if (currentView === 'section') {
      lblView.textContent = 'SECTION';
      btnSectionView.className = 'px-3 py-1 bg-surface-variant text-on-surface rounded font-body-md text-body-md';
      btnTeacherView.className = 'px-3 py-1 text-on-surface-variant hover:text-on-surface font-body-md text-body-md transition-colors';

      if (sections.length === 0) {
        addDisabledOption(selView, 'No generated sections');
      }

      sections.forEach(s => {
        const branch = branches.find(b => b.id === s.branchId);
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.text = `${branch?.name || '?'} Sem-${s.semester} Sec-${s.name}`;
        selView.appendChild(opt);
      });
      if (summaryPanel) summaryPanel.classList.add('hidden');
    } else {
      lblView.textContent = 'TEACHER';
      btnTeacherView.className = 'px-3 py-1 bg-surface-variant text-on-surface rounded font-body-md text-body-md';
      btnSectionView.className = 'px-3 py-1 text-on-surface-variant hover:text-on-surface font-body-md text-body-md transition-colors';

      if (teachers.length === 0) {
        addDisabledOption(selView, 'No generated teachers');
      }

      teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.text = t.name;
        selView.appendChild(opt);
      });
      if (summaryPanel) summaryPanel.classList.remove('hidden');
    }

    renderCurrentView();
  }

  function renderCurrentView() {
    if (!selView.value) {
      renderTimetableEmptyState(currentView === 'section' ? 'No generated sections to display.' : 'No generated teachers to display.');
      return;
    }
    if (currentView === 'section') {
      renderGrid(selView.value, result.timetable, data);
    } else {
      renderTeacherGrid(selView.value, result.timetable, data);
    }
  }

  if (selView) {
    selView.addEventListener('change', renderCurrentView);
  }

  if (btnSectionView) {
    btnSectionView.addEventListener('click', () => {
      if (currentView !== 'section') {
        currentView = 'section';
        updateViewUI();
      }
    });
  }

  if (btnTeacherView) {
    btnTeacherView.addEventListener('click', () => {
      if (currentView !== 'teacher') {
        currentView = 'teacher';
        updateViewUI();
      }
    });
  }

  // Initialize
  updateViewUI();

  // Violations
  renderViolationsPanel(result, data);
}

function addDisabledOption(select, text) {
  const opt = document.createElement('option');
  opt.value = '';
  opt.text = text;
  opt.disabled = true;
  opt.selected = true;
  select.appendChild(opt);
}

function getTeachersInTimetable(timetable, teachers) {
  const teacherIds = new Set();
  Object.values(timetable || {}).forEach(sectionGrid => {
    sectionGrid.forEach(dayGrid => {
      dayGrid.forEach(cell => {
        if (cell?.teacherId) teacherIds.add(cell.teacherId);
      });
    });
  });
  return teachers.filter(teacher => teacherIds.has(teacher.id));
}

function renderTimetableEmptyState(message) {
  const body = document.getElementById('timetable-body');
  if (!body) return;
  body.innerHTML = `
    <div class="col-span-6 min-h-[240px] flex items-center justify-center text-on-surface-variant font-body-md text-body-md">
      ${message}
    </div>`;
}

function renderGrid(sectionId, timetable, data) {
  const body = document.getElementById('timetable-body');
  if (!body) return;
  body.innerHTML = '';

  const grid = timetable[sectionId];
  if (!grid) {
    renderTimetableEmptyState('This section was not included in the generated timetable.');
    return;
  }

  const slotLabels = data.slotLabels;
  const breakIndices = data.breakIndices || new Set();
  const numDays = data.days.length;

  // Build mapping: visual slot index → teaching slot index
  // Visual slots include breaks; teaching slots are the GA grid indices
  let teachingIdx = 0;

  for (let visualSlot = 0; visualSlot < slotLabels.length; visualSlot++) {
    const isBreak = breakIndices.has(visualSlot);

    // Time label cell
    const timeCell = document.createElement('div');
    timeCell.className = 'border-b border-r border-outline-variant p-2 flex items-center justify-center font-caption text-caption text-on-surface-variant';

    if (isBreak) {
      // Break row — time label
      timeCell.innerHTML = `<span class="italic text-xs">${slotLabels[visualSlot]}</span>`;
      timeCell.style.background = 'rgba(99, 102, 241, 0.08)';
      body.appendChild(timeCell);

      // Break row — span across all day columns
      for (let day = 0; day < numDays; day++) {
        const breakCell = document.createElement('div');
        const isLast = day === numDays - 1;
        breakCell.className = `border-b ${isLast ? '' : 'border-r'} border-outline-variant p-1 flex items-center justify-center`;
        breakCell.style.background = 'rgba(99, 102, 241, 0.08)';
        if (day === Math.floor(numDays / 2)) {
          breakCell.innerHTML = `<span class="font-caption text-caption text-primary/60 italic text-xs">${slotLabels[visualSlot] === 'LUNCH BREAK' ? 'Lunch Break' : 'Short Break'}</span>`;
        }
        body.appendChild(breakCell);
      }
      continue; // Don't increment teachingIdx for breaks
    }

    timeCell.innerHTML = slotLabels[visualSlot].replace('-', '<br/>');
    body.appendChild(timeCell);

    const slot = teachingIdx; // This is the GA grid slot index

    // Day cells
    for (let day = 0; day < numDays; day++) {
      const cell = grid[day][slot];
      const div = document.createElement('div');
      const isLast = day === numDays - 1;
      div.className = `border-b ${isLast ? '' : 'border-r'} border-outline-variant p-2 relative`;

      if (!cell) {
        // Check if rest after lab
        if (slot > 0 && grid[day][slot - 1] && grid[day][slot - 1].type === 'lab_cont') {
          div.innerHTML = `<div class="flex items-center justify-center h-full font-caption text-caption text-integrity-success italic">Free Slot</div>`;
          div.classList.add('bg-surface-container-lowest');
        } else {
          // Empty
          div.innerHTML = '';
        }
      } else if (cell.type === 'lab_cont') {
        div.classList.add('bg-surface-container-highest');
        div.innerHTML = `
          <div class="absolute top-1 left-1 bottom-1 w-1 bg-primary rounded-l"></div>
          <div class="ml-2 pl-2 flex flex-col justify-center h-full">
            <span class="font-caption text-caption text-on-surface-variant italic">(Lab cont.)</span>
          </div>`;
      } else {
        const subject = data.subjects.find(s => s.id === cell.subjectId);
        const teacher = cell.teacherId ? data.teachers.find(t => t.id === cell.teacherId) : null;
        const room = data.rooms.find(r => r.id === cell.roomId);
        const isLab = cell.type === 'lab' || cell.type === 'practical';
        const accentColor = isLab ? 'bg-primary' : 'bg-integrity-success';

        if (isLab) div.classList.add('bg-surface-container-highest');

        div.innerHTML = `
          <div class="absolute top-1 left-1 bottom-1 w-1 ${accentColor} rounded-l"></div>
          <div class="ml-2 pl-2 flex flex-col justify-center h-full">
            <span class="font-body-md text-body-md text-on-surface font-semibold">${subject?.name || ''}${isLab ? ' Lab' : ''}</span>
            ${teacher ? `<span class="font-caption text-caption text-on-surface-variant">${teacher.name}</span>` : ''}
            ${room ? `<span class="font-caption text-caption text-secondary font-semibold text-[11px]">${room.id}</span>` : ''}
          </div>`;
      }

      body.appendChild(div);
    }

    teachingIdx++;
  }
}

function renderTeacherGrid(teacherId, timetable, data) {
  const body = document.getElementById('timetable-body');
  if (!body) return;
  body.innerHTML = '';

  const slotLabels = data.slotLabels;
  const breakIndices = data.breakIndices || new Set();
  const numDays = data.days.length;

  // Track how many research/misc slots we've filled across the whole week
  let researchFilled = 0;
  let miscFilled = 0;
  const RESEARCH_HOURS = 3;
  const MISC_HOURS = 1;

  let teachingIdx = 0;

  for (let visualSlot = 0; visualSlot < slotLabels.length; visualSlot++) {
    const isBreak = breakIndices.has(visualSlot);

    const timeCell = document.createElement('div');
    timeCell.className = 'border-b border-r border-outline-variant p-2 flex items-center justify-center font-caption text-caption text-on-surface-variant';

    if (isBreak) {
      timeCell.innerHTML = `<span class="italic text-xs">${slotLabels[visualSlot]}</span>`;
      timeCell.style.background = 'rgba(99, 102, 241, 0.08)';
      body.appendChild(timeCell);

      for (let day = 0; day < numDays; day++) {
        const breakCell = document.createElement('div');
        const isLast = day === numDays - 1;
        breakCell.className = `border-b ${isLast ? '' : 'border-r'} border-outline-variant p-1 flex items-center justify-center`;
        breakCell.style.background = 'rgba(99, 102, 241, 0.08)';
        if (day === Math.floor(numDays / 2)) {
          breakCell.innerHTML = `<span class="font-caption text-caption text-primary/60 italic text-xs">${slotLabels[visualSlot] === 'LUNCH BREAK' ? 'Lunch Break' : 'Short Break'}</span>`;
        }
        body.appendChild(breakCell);
      }
      continue;
    }

    timeCell.innerHTML = slotLabels[visualSlot].replace('-', '<br/>');
    body.appendChild(timeCell);

    const slot = teachingIdx;

    for (let day = 0; day < numDays; day++) {
      let cellText = '';
      let cellColor = '';
      let isLabCont = false;
      let found = false;

      for (const sectionId of Object.keys(timetable)) {
        const cell = timetable[sectionId][day][slot];
        if (cell && cell.teacherId === teacherId) {
          found = true;
          if (cell.type === 'lab_cont') {
            isLabCont = true;
          } else {
            const subject = data.subjects.find(s => s.id === cell.subjectId);
            const section = data.sections.find(s => s.id === sectionId);
            const branch = section ? data.branches.find(b => b.id === section.branchId) : null;
            const isLab = cell.type === 'lab' || cell.type === 'practical';
            cellColor = isLab ? 'bg-primary' : 'bg-integrity-success';
            cellText = `
              <div class="absolute top-1 left-1 bottom-1 w-1 ${cellColor} rounded-l"></div>
              <div class="ml-2 pl-2 flex flex-col justify-center h-full">
                <span class="font-body-md text-body-md text-on-surface font-semibold">${subject?.name || ''}${isLab ? ' Lab' : ''}</span>
                <span class="font-caption text-caption text-on-surface-variant">${branch?.name || ''} Sec-${section?.name || ''}</span>
              </div>`;
          }
          break;
        }
      }

      const div = document.createElement('div');
      const isLast = day === numDays - 1;
      div.className = `border-b ${isLast ? '' : 'border-r'} border-outline-variant p-2 relative`;

      if (found) {
        if (isLabCont) {
          div.classList.add('bg-surface-container-highest');
          div.innerHTML = `
            <div class="absolute top-1 left-1 bottom-1 w-1 bg-primary rounded-l"></div>
            <div class="ml-2 pl-2 flex flex-col justify-center h-full">
              <span class="font-caption text-caption text-on-surface-variant italic">(Lab cont.)</span>
            </div>`;
        } else {
          if (cellColor === 'bg-primary') div.classList.add('bg-surface-container-highest');
          div.innerHTML = cellText;
        }
      } else {
        // Check if rest slot after lab
        let wasInLabCont = false;
        if (slot > 0) {
          for (const sectionId of Object.keys(timetable)) {
            const prevCell = timetable[sectionId][day][slot - 1];
            if (prevCell && prevCell.teacherId === teacherId && prevCell.type === 'lab_cont') {
              wasInLabCont = true;
              break;
            }
          }
        }

        if (wasInLabCont) {
          div.innerHTML = `<div class="flex items-center justify-center h-full font-caption text-caption text-integrity-success italic">Free Slot</div>`;
          div.classList.add('bg-surface-container-lowest');
        } else if (researchFilled < RESEARCH_HOURS) {
          // Fill with Research
          researchFilled++;
          div.classList.add('bg-surface-container-low');
          div.innerHTML = `
            <div class="absolute top-1 left-1 bottom-1 w-1 bg-tertiary rounded-l"></div>
            <div class="ml-2 pl-2 flex flex-col justify-center h-full">
              <span class="font-body-md text-body-md text-on-surface font-semibold">Research</span>
              <span class="font-caption text-caption text-on-surface-variant">Self-directed</span>
            </div>`;
        } else if (miscFilled < MISC_HOURS) {
          // Fill with Misc
          miscFilled++;
          div.classList.add('bg-surface-container-low');
          div.innerHTML = `
            <div class="absolute top-1 left-1 bottom-1 w-1 bg-tertiary rounded-l"></div>
            <div class="ml-2 pl-2 flex flex-col justify-center h-full">
              <span class="font-body-md text-body-md text-on-surface font-semibold">Miscellaneous</span>
              <span class="font-caption text-caption text-on-surface-variant">Admin duties</span>
            </div>`;
        }
        // remaining free slots stay empty
      }

      body.appendChild(div);
    }

    teachingIdx++;
  }

  // Hide the old summary panel if it exists
  const summary = document.getElementById('teacher-research-summary');
  if (summary) summary.classList.add('hidden');
}

function renderViolationsPanel(result, data) {
  const list = document.getElementById('violations-list');
  if (!list) return;
  list.innerHTML = '';

  const hard = result.fitness.hardDetails || [];
  const soft = result.fitness.softDetails || [];

  if (hard.length === 0 && soft.length === 0) {
    list.innerHTML = `<div class="flex items-center gap-2 text-integrity-success font-body-md text-body-md">
      <span class="material-symbols-outlined text-[16px]">check_circle</span>
      No constraint violations detected.
    </div>`;
    return;
  }

  hard.forEach(v => {
    const el = document.createElement('div');
    el.className = 'flex items-start gap-3 p-3 bg-surface border border-error/20 rounded';
    el.innerHTML = `<span class="material-symbols-outlined text-error text-lg mt-0.5">error</span>
      <div>
        <div class="font-body-md text-body-md text-on-surface font-medium">${v.type}</div>
        <div class="font-caption text-caption text-on-surface-variant mt-1">${v.message}</div>
      </div>`;
    list.appendChild(el);
  });

  soft.forEach(v => {
    const el = document.createElement('div');
    el.className = 'flex items-start gap-3 p-3 bg-surface border border-tertiary/20 rounded';
    el.innerHTML = `<span class="material-symbols-outlined text-tertiary text-lg mt-0.5">warning</span>
      <div>
        <div class="font-body-md text-body-md text-on-surface font-medium">${v.type}</div>
        <div class="font-caption text-caption text-on-surface-variant mt-1">${v.message}</div>
      </div>`;
    list.appendChild(el);
  });
}

// ================================================================
// PAGE: EXPORT
// ================================================================
function initExportPage() {
  const result = loadResult();
  if (!result || !result.timetable) {
    showToast('No timetable generated yet. Go to the Generate page first.', 'error');
    return;
  }

  const data = TimetableData.getAllData();
  const generatedSectionIds = new Set(Object.keys(result.timetable || {}));
  const sections = data.sections.filter(section => generatedSectionIds.has(section.id));
  const generatedBranchIds = new Set(sections.map(section => section.branchId));
  const branches = data.branches.filter(branch => generatedBranchIds.has(branch.id));

  const selBranch = document.getElementById('export-branch-select');
  const selSection = document.getElementById('export-section-select');

  // Populate branches
  if (selBranch) {
    selBranch.innerHTML = '';
    if (branches.length === 0) {
      addDisabledOption(selBranch, 'No generated branches');
    }

    branches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.text = b.name;
      selBranch.appendChild(opt);
    });
    selBranch.addEventListener('change', () => {
      updateExportSections(selBranch.value, selSection, sections, branches);
      updatePreview(selSection, result, data);
    });
    // Initial populate
    if (selBranch.value) {
      updateExportSections(selBranch.value, selSection, sections, branches);
    }
  }

  if (selSection) {
    selSection.addEventListener('change', () => updatePreview(selSection, result, data));
  }

  // Buttons
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const sid = selSection?.value;
    if (sid) {
      TimetableExport.exportSectionCSV(sid, result.timetable, data);
      showToast('CSV downloaded!', 'success');
    }
  });

  document.getElementById('btn-export-all')?.addEventListener('click', () => {
    TimetableExport.exportAllCSVs(result.timetable, data);
    showToast('Downloading all CSVs...', 'success');
  });

  document.getElementById('btn-print')?.addEventListener('click', () => {
    const sid = selSection?.value;
    if (sid) {
      TimetableExport.printTimetable(sid, result.timetable, data);
    }
  });

  document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
    const sid = selSection?.value;
    if (sid) {
      TimetableExport.printTimetable(sid, result.timetable, data);
    } else {
      showToast('Please select a section to export.', 'error');
    }
  });

  // Initial preview
  setTimeout(() => updatePreview(selSection, result, data), 100);
}

function updateExportSections(branchId, selSection, sections, branches) {
  if (!selSection) return;
  selSection.innerHTML = '';
  const filtered = sections.filter(s => s.branchId === branchId);

  if (filtered.length === 0) {
    addDisabledOption(selSection, 'No generated sections');
    return;
  }

  filtered.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.text = `Sem ${s.semester} — Section ${s.name}`;
    selSection.appendChild(opt);
  });
}

function updatePreview(selSection, result, data) {
  const preview = document.getElementById('export-preview');
  if (!preview) return;
  if (!selSection?.value) {
    preview.innerHTML = `
      <div class="h-full min-h-[240px] flex items-center justify-center text-on-surface-variant font-body-md text-body-md">
        No generated section selected.
      </div>`;
    return;
  }
  preview.innerHTML = TimetableExport.generatePreviewHTML(selSection.value, result.timetable, data);
}
