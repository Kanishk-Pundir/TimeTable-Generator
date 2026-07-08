// ============================================================
// export.js — CSV Export & Print Functionality
// ============================================================

const TimetableExport = (() => {

  /**
   * Generate CSV string for a single section's timetable.
   * @param {string} sectionId
   * @param {Object} timetable - The full timetable object from GA result
   * @param {Object} data - From TimetableData.getAllData()
   * @returns {string} CSV content
   */
  function generateCSV(sectionId, timetable, data) {
    const grid = timetable[sectionId];
    if (!grid) return '';

    const section = data.sections.find(s => s.id === sectionId);
    const branch = section ? data.branches.find(b => b.id === section.branchId) : null;

    const rows = [];

    // Header row: Branch / Section info
    rows.push(`"Timetable - ${branch?.name || 'Unknown'} ${section?.name || ''} Sem-${section?.semester || '?'}"`);
    rows.push(''); // blank line

    // Column headers
    const header = ['Time Slot', ...data.days];
    rows.push(header.map(h => `"${h}"`).join(','));

    // Data rows
    const breakIndices = data.breakIndices || new Set();
    let teachingIdx = 0;

    for (let visualSlot = 0; visualSlot < data.slotLabels.length; visualSlot++) {
      if (breakIndices.has(visualSlot)) {
        // Break row
        const row = [data.slotLabels[visualSlot]];
        for (let day = 0; day < data.days.length; day++) {
          row.push(data.slotLabels[visualSlot] === 'LUNCH BREAK' ? '--- LUNCH ---' : '--- BREAK ---');
        }
        rows.push(row.map(c => `"${c}"`).join(','));
        continue;
      }

      const slot = teachingIdx;
      const row = [data.slotLabels[visualSlot]];

      for (let day = 0; day < data.days.length; day++) {
        const cell = grid[day][slot];
        if (!cell) {
          // Check if this is a rest-after-lab slot
          if (slot > 0 && grid[day][slot - 1] && grid[day][slot - 1].type === 'lab_cont') {
            row.push('FREE (Rest)');
          } else {
            row.push('---');
          }
        } else if (cell.type === 'lab_cont') {
          // Part of lab continuation — skip display (lab start covers it)
          row.push('(Lab cont.)');
        } else {
          const subject = data.subjects.find(s => s.id === cell.subjectId);
          const teacher = cell.teacherId ? data.teachers.find(t => t.id === cell.teacherId) : null;
          const room = cell.roomId ? data.rooms.find(r => r.id === cell.roomId) : null;
          const typeLabel = cell.type === 'lab' ? ' [LAB]' : '';
          const teacherPart = teacher ? ` - ${teacher.name}` : '';
          const roomPart = room ? ` [${room.id}]` : '';
          row.push(`${subject?.code || ''}${typeLabel}${teacherPart}${roomPart}`);
        }
      }

      rows.push(row.map(c => `"${c}"`).join(','));
      teachingIdx++;
    }

    return rows.join('\n');
  }

  /**
   * Generate a teacher-view CSV showing a teacher's weekly schedule.
   * @param {string} teacherId
   * @param {Object} timetable
   * @param {Object} data
   * @returns {string} CSV content
   */
  function generateTeacherCSV(teacherId, timetable, data) {
    const teacher = data.teachers.find(t => t.id === teacherId);
    if (!teacher) return '';

    const rows = [];
    rows.push(`"Teacher Schedule - ${teacher.name}"`);
    rows.push('');

    const header = ['Time Slot', ...data.days];
    rows.push(header.map(h => `"${h}"`).join(','));

    let teachingIdx = 0;

    for (let visualSlot = 0; visualSlot < data.slotLabels.length; visualSlot++) {
      const breakIndices = data.breakIndices || new Set();
      if (breakIndices.has(visualSlot)) {
        const row = [data.slotLabels[visualSlot]];
        for (let day = 0; day < data.days.length; day++) {
          row.push(data.slotLabels[visualSlot] === 'LUNCH BREAK' ? '--- LUNCH ---' : '--- BREAK ---');
        }
        rows.push(row.map(c => `"${c}"`).join(','));
        continue;
      }

      const slot = teachingIdx;
      const row = [data.slotLabels[visualSlot]];

      for (let day = 0; day < data.days.length; day++) {
        let cellText = '---';

        for (const sectionId of Object.keys(timetable)) {
          const cell = timetable[sectionId][day][slot];
          if (cell && cell.teacherId === teacherId && cell.type !== 'lab_cont') {
            const subject = data.subjects.find(s => s.id === cell.subjectId);
            const section = data.sections.find(s => s.id === sectionId);
            const branch = section ? data.branches.find(b => b.id === section.branchId) : null;
            const typeLabel = cell.type === 'lab' ? ' [LAB]' : '';
            cellText = `${subject?.code || '?'}${typeLabel} (${branch?.name || '?'}-${section?.name || '?'})`;
            break;
          }
        }

        row.push(cellText);
      }

      rows.push(row.map(c => `"${c}"`).join(','));
      teachingIdx++;
    }

    return rows.join('\n');
  }

  /**
   * Download a CSV string as a file.
   */
  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 100);
  }

  /**
   * Export a single section's timetable as CSV.
   */
  function exportSectionCSV(sectionId, timetable, data) {
    const section = data.sections.find(s => s.id === sectionId);
    const branch = section ? data.branches.find(b => b.id === section.branchId) : null;

    const csv = generateCSV(sectionId, timetable, data);
    const filename = `timetable_${branch?.name || 'unknown'}_${section?.name || 'X'}_sem${section?.semester || 0}.csv`;
    downloadCSV(csv, filename);
  }

  /**
   * Export all sections' timetables as individual CSV files.
   * Downloads them sequentially with a slight delay.
   */
  function exportAllCSVs(timetable, data) {
    const sectionIds = Object.keys(timetable);
    let delay = 0;

    for (const sectionId of sectionIds) {
      setTimeout(() => {
        exportSectionCSV(sectionId, timetable, data);
      }, delay);
      delay += 300; // 300ms between downloads to avoid browser blocking
    }
  }

  /**
   * Print a timetable grid. Opens a print-friendly window.
   * @param {string} sectionId - The section to print
   * @param {Object} timetable
   * @param {Object} data
   */
  function printTimetable(sectionId, timetable, data) {
    const grid = timetable[sectionId];
    if (!grid) return;

    const section = data.sections.find(s => s.id === sectionId);
    const branch = section ? data.branches.find(b => b.id === section.branchId) : null;

    const title = `${branch?.name || 'Unknown'} - Section ${section?.name || '?'} - Semester ${section?.semester || '?'}`;

    // Build print-friendly HTML table
    let tableHTML = `
      <table>
        <thead>
          <tr>
            <th>Time</th>
            ${data.days.map(d => `<th>${d}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    const breakIndices = data.breakIndices || new Set();
    let teachingIdx = 0;

    for (let visualSlot = 0; visualSlot < data.slotLabels.length; visualSlot++) {
      if (breakIndices.has(visualSlot)) {
        tableHTML += '<tr>';
        tableHTML += `<td class="time-col" style="background:#eef2ff;color:#6366f1;font-style:italic;">${data.slotLabels[visualSlot]}</td>`;
        for (let day = 0; day < data.days.length; day++) {
          tableHTML += `<td style="background:#eef2ff;color:#6366f1;text-align:center;font-style:italic;font-size:10px;">☕</td>`;
        }
        tableHTML += '</tr>';
        continue;
      }

      const slot = teachingIdx;
      tableHTML += '<tr>';
      tableHTML += `<td class="time-col">${data.slotLabels[visualSlot]}</td>`;

      for (let day = 0; day < data.days.length; day++) {
        const cell = grid[day][slot];

        if (!cell) {
          // Check rest after lab
          if (slot > 0 && grid[day][slot - 1] && grid[day][slot - 1].type === 'lab_cont') {
            tableHTML += '<td class="rest-cell">FREE</td>';
          } else {
            tableHTML += '<td class="empty-cell">-</td>';
          }
        } else if (cell.type === 'lab_cont') {
          tableHTML += '<td class="lab-cont-cell">↑ Lab</td>';
        } else {
          const subject = data.subjects.find(s => s.id === cell.subjectId);
          const teacher = cell.teacherId ? data.teachers.find(t => t.id === cell.teacherId) : null;
          const room = cell.roomId ? data.rooms.find(r => r.id === cell.roomId) : null;
          const cellClass = cell.type === 'lab' ? 'lab-cell' : 'theory-cell';
          tableHTML += `<td class="${cellClass}">
            <strong>${subject?.code || ''}</strong>${cell.type === 'lab' ? ' 🔬' : ''}
            <br><small>${subject?.name || ''}</small>
            ${teacher ? `<br><em>${teacher.name}</em>` : ''}
            ${room ? `<br><span style="font-size:9px;color:#8f4c2e;font-weight:600;">${room.id}</span>` : ''}
          </td>`;
        }
      }

      tableHTML += '</tr>';
      teachingIdx++;
    }

    tableHTML += '</tbody></table>';

    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Timetable</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Inter', sans-serif;
            padding: 24px;
            color: #1e293b;
            background: #fff;
          }

          h1 {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 4px;
          }

          .subtitle {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 20px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }

          th {
            background: #6366f1;
            color: #fff;
            padding: 10px 6px;
            font-weight: 600;
            text-align: center;
            border: 1px solid #4f46e5;
          }

          td {
            padding: 8px 6px;
            text-align: center;
            border: 1px solid #e2e8f0;
            vertical-align: top;
            min-height: 50px;
          }

          .time-col {
            font-weight: 600;
            background: #f1f5f9;
            white-space: nowrap;
            width: 90px;
          }

          .theory-cell {
            background: #f0f9ff;
          }

          .lab-cell {
            background: #faf5ff;
            border-left: 3px solid #8b5cf6;
          }

          .lab-cont-cell {
            background: #faf5ff;
            color: #a78bfa;
            font-size: 10px;
            border-left: 3px solid #8b5cf6;
          }

          .rest-cell {
            background: #f0fdf4;
            color: #16a34a;
            font-weight: 600;
          }

          .empty-cell {
            color: #cbd5e1;
          }

          td strong {
            color: #1e293b;
            font-size: 12px;
          }

          td small {
            color: #64748b;
            font-size: 9px;
          }

          td em {
            color: #6366f1;
            font-style: normal;
            font-size: 10px;
          }

          .footer {
            margin-top: 16px;
            font-size: 10px;
            color: #94a3b8;
            text-align: center;
          }

          @media print {
            body { padding: 12px; }
            table { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>🗓️ ${title}</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        ${tableHTML}
        <div class="footer">Generated by TimeTable Generator</div>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    }
  }

  /**
   * Generate an HTML preview of a timetable for embedding in the export view.
   * Returns an HTML string.
   */
  function generatePreviewHTML(sectionId, timetable, data) {
    const grid = timetable[sectionId];
    if (!grid) return '<p style="color: #94a3b8;">No timetable generated yet.</p>';

    const section = data.sections.find(s => s.id === sectionId);
    const branch = section ? data.branches.find(b => b.id === section.branchId) : null;

    let html = `<div class="export-preview-title">${branch?.name || '?'} - Section ${section?.name || '?'} - Sem ${section?.semester || '?'}</div>`;
    html += '<table class="preview-table"><thead><tr><th>Time</th>';

    for (const day of data.days) {
      html += `<th>${day.substring(0, 3)}</th>`;
    }
    html += '</tr></thead><tbody>';

    const breakIndices = data.breakIndices || new Set();
    let teachingIdx = 0;

    for (let visualSlot = 0; visualSlot < data.slotLabels.length; visualSlot++) {
      if (breakIndices.has(visualSlot)) {
        html += `<tr><td class="pv-time" style="background:rgba(99,102,241,0.08);font-style:italic;font-size:10px;">${data.slotLabels[visualSlot]}</td>`;
        for (let day = 0; day < data.days.length; day++) {
          html += `<td style="background:rgba(99,102,241,0.08);text-align:center;font-style:italic;color:#6366f1;font-size:10px;">☕</td>`;
        }
        html += '</tr>';
        continue;
      }

      const slot = teachingIdx;
      html += `<tr><td class="pv-time">${data.slotLabels[visualSlot]}</td>`;

      for (let day = 0; day < data.days.length; day++) {
        const cell = grid[day][slot];

        if (!cell) {
          if (slot > 0 && grid[day][slot - 1] && grid[day][slot - 1].type === 'lab_cont') {
            html += '<td class="pv-rest">FREE</td>';
          } else {
            html += '<td class="pv-empty">-</td>';
          }
        } else if (cell.type === 'lab_cont') {
          html += '<td class="pv-labcont">↑</td>';
        } else {
          const subject = data.subjects.find(s => s.id === cell.subjectId);
          const teacher = cell.teacherId ? data.teachers.find(t => t.id === cell.teacherId) : null;
          const room = cell.roomId ? data.rooms.find(r => r.id === cell.roomId) : null;
          const cls = cell.type === 'lab' ? 'pv-lab' : 'pv-theory';
          html += `<td class="${cls}">
            <strong>${subject?.code || ''}</strong>
            ${cell.type === 'lab' ? ' 🔬' : ''}
            <br><small>${teacher?.name || ''}</small>
            ${room ? `<br><span style="font-size:9px;color:#8f4c2e;font-weight:600;">${room.id}</span>` : ''}
          </td>`;
        }
      }

      html += '</tr>';
      teachingIdx++;
    }

    html += '</tbody></table>';
    return html;
  }

  // ---- PUBLIC API ----
  return {
    generateCSV,
    generateTeacherCSV,
    downloadCSV,
    exportSectionCSV,
    exportAllCSVs,
    printTimetable,
    generatePreviewHTML
  };
})();
