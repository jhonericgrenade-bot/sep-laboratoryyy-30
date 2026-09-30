const storeKey = 'scholartrack-data-v1';

const seed = {
  programs: [
    { id: 'p1', name: 'University Merit Scholarship', gwa: 1.75, units: 18, allowFailing: false },
    { id: 'p2', name: 'Government Academic Grant', gwa: 2.25, units: 15, allowFailing: false },
    { id: 'p3', name: 'Private Partner Scholarship', gwa: 2.50, units: 12, allowFailing: true }
  ],
  scholars: [
    { id: 's1', studentId: '2026-0001', name: 'Maria Santos', degree: 'BS Information Technology', year: '3rd Year', programId: 'p1', status: 'Compliant' },
    { id: 's2', studentId: '2026-0002', name: 'John dela Cruz', degree: 'BS Computer Science', year: '2nd Year', programId: 'p2', status: 'With Deficiency' },
    { id: 's3', studentId: '2026-0003', name: 'Ana Reyes', degree: 'BS Accountancy', year: '4th Year', programId: 'p1', status: 'Pending Submission' },
    { id: 's4', studentId: '2026-0004', name: 'Luis Garcia', degree: 'BS Engineering', year: '2nd Year', programId: 'p3', status: 'Active' }
  ],
  submissions: [
    { id: 'g1', scholarId: 's1', year: '2026–2027', semester: '1st Semester', gwa: 1.50, units: 21, failed: 0, incomplete: 0, status: 'Verified', submittedAt: '2026-09-28T09:15:00', verifiedAt: '2026-09-29T10:00:00' },
    { id: 'g2', scholarId: 's2', year: '2026–2027', semester: '1st Semester', gwa: 2.40, units: 18, failed: 0, incomplete: 1, status: 'Verified', submittedAt: '2026-09-27T09:15:00', verifiedAt: '2026-09-28T10:00:00' },
    { id: 'g3', scholarId: 's3', year: '2026–2027', semester: '1st Semester', gwa: 1.60, units: 20, failed: 0, incomplete: 0, status: 'Pending', submittedAt: '2026-09-30T09:15:00' },
    { id: 'g4', scholarId: 's4', year: '2026–2027', semester: '1st Semester', gwa: 2.20, units: 18, failed: 0, incomplete: 0, status: 'Pending', submittedAt: '2026-09-30T08:20:00' }
  ]
};

let data = JSON.parse(localStorage.getItem(storeKey) || 'null') || structuredClone(seed);
let supabaseClient = null;
const $ = (selector) => document.querySelector(selector);
const initials = (name) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
const uid = (prefix) => `${prefix}-${Date.now()}`;
const programFor = (scholar) => data.programs.find(p => p.id === scholar.programId);
const scholarFor = (submission) => data.scholars.find(s => s.id === submission.scholarId);
const save = () => localStorage.setItem(storeKey, JSON.stringify(data));

function badge(value) {
  const style = value === 'Compliant' || value === 'Verified' || value === 'Active' ? 'green' :
    value === 'With Deficiency' || value === 'Returned' ? 'red' : value === 'Pending' || value === 'Pending Submission' ? 'amber' : 'gray';
  return `<span class="badge ${style}">${value}</span>`;
}

function evaluation(submission) {
  const scholar = scholarFor(submission);
  const program = scholar && programFor(scholar);
  if (!program) return { status: 'With Deficiency', reason: 'Scholarship program is missing.' };
  const reasons = [];
  if (Number(submission.gwa) > Number(program.gwa)) reasons.push(`GWA ${submission.gwa.toFixed(2)} exceeds ${program.gwa.toFixed(2)}`);
  if (Number(submission.units) < Number(program.units)) reasons.push(`${submission.units} units is below ${program.units}`);
  if (!program.allowFailing && Number(submission.failed) > 0) reasons.push('Failing grade is not allowed');
  if (Number(submission.incomplete) > 0) reasons.push('Incomplete subject(s) must be cleared');
  return reasons.length ? { status: 'With Deficiency', reason: reasons.join('; ') } : { status: 'Compliant', reason: 'All academic requirements were satisfied.' };
}

function updateScholarStatus(submission) {
  const scholar = scholarFor(submission);
  if (!scholar) return;
  const result = evaluation(submission);
  scholar.status = result.status;
}

function renderStats() {
  const active = data.scholars.length;
  const pending = data.submissions.filter(s => s.status === 'Pending').length;
  const verified = data.submissions.filter(s => s.status === 'Verified');
  const compliant = verified.filter(s => evaluation(s).status === 'Compliant').length;
  const deficiency = verified.filter(s => evaluation(s).status === 'With Deficiency').length;
  const items = [['Total Scholars', active, '♙'], ['Pending Submissions', pending, '◷'], ['Verified Submissions', verified.length, '✓'], ['Compliant Scholars', compliant, '●'], ['With Deficiency', deficiency, '△']];
  $('#stats').innerHTML = items.map(([label, value, icon]) => `<article class="stat"><span class="stat-icon">${icon}</span><div class="stat-label">${label}</div><div class="stat-value">${value}</div></article>`).join('');
  const total = verified.length || 1;
  $('#compliance-overview').innerHTML = [
    ['Compliant', compliant, '#36a876'], ['With Deficiency', deficiency, '#db6670'], ['Awaiting Verification', pending, '#eba931']
  ].map(([label, value, color]) => `<div class="status-row"><div class="status-title"><span>${label}</span><strong>${value}</strong></div><div class="bar"><div style="width:${Math.round(value / total * 100)}%;background:${color}"></div></div></div>`).join('');
}

function renderRecent() {
  const records = [...data.submissions].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5);
  $('#recent-submissions').innerHTML = records.map(s => {
    const scholar = scholarFor(s);
    return `<tr><td><div class="person"><div class="avatar">${initials(scholar.name)}</div>${scholar.name}</div></td><td>${s.year}<br><small>${s.semester}</small></td><td>${Number(s.gwa).toFixed(2)}</td><td>${badge(s.status)}</td></tr>`;
  }).join('') || '<tr><td colspan="4">No submissions yet.</td></tr>';
}

function renderProgramOptions() {
  const options = '<option value="">Select scholarship</option>' + data.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  $('#scholar-program').innerHTML = options;
  $('#scholar-filter').innerHTML = '<option value="">All scholarship programs</option>' + data.programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  $('#submission-scholar').innerHTML = '<option value="">Select scholar</option>' + data.scholars.map(s => `<option value="${s.id}">${s.studentId} — ${s.name}</option>`).join('');
}

function renderScholars() {
  const query = $('#scholar-search').value.trim().toLowerCase();
  const programId = $('#scholar-filter').value;
  const status = $('#status-filter').value;
  const rows = data.scholars.filter(s => (!query || `${s.studentId} ${s.name}`.toLowerCase().includes(query)) && (!programId || s.programId === programId) && (!status || s.status === status));
  $('#scholars-table').innerHTML = rows.map(s => `<tr><td>${s.studentId}</td><td><div class="person"><div class="avatar">${initials(s.name)}</div><div>${s.name}<br><small>${s.year}</small></div></div></td><td>${s.degree}</td><td>${programFor(s)?.name || '—'}</td><td>${badge(s.status)}</td><td><button class="action-button" data-edit-scholar="${s.id}">Edit</button></td></tr>`).join('') || '<tr><td colspan="6">No scholars match your search.</td></tr>';
}

function renderPrograms() {
  $('#program-cards').innerHTML = data.programs.map(p => `<article class="panel program-card"><h3>${p.name}</h3><p>${p.allowFailing ? 'Failing grades allowed' : 'No failing grades allowed'}. Academic eligibility is checked upon verification.</p><div class="program-meta"><span>Required GWA <strong>${Number(p.gwa).toFixed(2)} or better</strong></span><span>Min. Units <strong>${p.units}</strong></span></div></article>`).join('');
}

function renderSubmissions() {
  const filter = $('#submission-filter').value;
  const rows = data.submissions.filter(s => !filter || s.status === filter).sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  $('#submissions-table').innerHTML = rows.map(s => { const scholar = scholarFor(s); return `<tr><td><strong>${scholar?.name || 'Unknown scholar'}</strong><br><small>${scholar?.studentId || ''}</small></td><td>${s.year}<br><small>${s.semester}</small></td><td>${Number(s.gwa).toFixed(2)}</td><td>${s.units}</td><td>${new Date(s.submittedAt).toLocaleDateString()}</td><td>${badge(s.status)}</td><td>${s.status === 'Pending' ? `<button class="action-button" data-verify="${s.id}">Verify</button>` : '—'}</td></tr>`; }).join('') || '<tr><td colspan="7">No submissions found.</td></tr>';
}

function renderCompliance() {
  const records = data.submissions.filter(s => s.status === 'Verified').sort((a,b) => new Date(b.verifiedAt) - new Date(a.verifiedAt));
  $('#compliance-table').innerHTML = records.map(s => { const scholar = scholarFor(s), result = evaluation(s); return `<tr><td>${scholar?.name || 'Unknown scholar'}<br><small>${scholar?.studentId || ''}</small></td><td>${programFor(scholar)?.name || '—'}</td><td>${s.year}<br><small>${s.semester}</small></td><td>${badge(result.status)}</td><td>${result.reason}</td></tr>`; }).join('') || '<tr><td colspan="5">No verified submissions to evaluate.</td></tr>';
}

function renderAll() { renderProgramOptions(); renderStats(); renderRecent(); renderScholars(); renderPrograms(); renderSubmissions(); renderCompliance(); }

function openModal(id) { $('#modal-backdrop').classList.add('visible'); $(`#${id}`).showModal(); }
function closeModals() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); $('#modal-backdrop').classList.remove('visible'); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `${page}-page`));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const title = { dashboard: 'Dashboard', scholars: 'Scholar Records', programs: 'Scholarship Programs', submissions: 'Grade Submissions', compliance: 'Compliance Monitoring' }[page];
  $('#page-title').textContent = title; $('#page-eyebrow').textContent = page === 'dashboard' ? 'OVERVIEW' : 'SCHOLARSHIP OFFICE';
  document.querySelector('.sidebar').classList.remove('open');
}

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-page]'); if (nav) navigate(nav.dataset.page);
  const link = event.target.closest('[data-page-link]'); if (link) navigate(link.dataset.pageLink);
  const open = event.target.closest('[data-open-modal]'); if (open) { if (open.dataset.openModal === 'scholar-modal') { $('#scholar-form').reset(); $('#scholar-id').value = ''; $('#scholar-error').textContent = ''; $('#scholar-modal-title').textContent = 'Register Scholar'; } openModal(open.dataset.openModal); }
  if (event.target.closest('.close-modal') || event.target === $('#modal-backdrop')) closeModals();
  const edit = event.target.closest('[data-edit-scholar]'); if (edit) editScholar(edit.dataset.editScholar);
  const verify = event.target.closest('[data-verify]'); if (verify) verifySubmission(verify.dataset.verify);
  if (event.target.closest('.menu-toggle')) document.querySelector('.sidebar').classList.toggle('open');
});

function editScholar(id) {
  const s = data.scholars.find(x => x.id === id); if (!s) return;
  $('#scholar-form').reset(); $('#scholar-id').value = s.id; $('#student-id').value = s.studentId; $('#scholar-name').value = s.name; $('#degree-program').value = s.degree; $('#year-level').value = s.year; $('#scholar-program').value = s.programId; $('#scholar-modal-title').textContent = 'Edit Scholar'; openModal('scholar-modal');
}
function verifySubmission(id) {
  const submission = data.submissions.find(s => s.id === id); if (!submission || submission.status !== 'Pending') return;
  submission.status = 'Verified'; submission.verifiedAt = new Date().toISOString(); updateScholarStatus(submission); save(); renderAll(); toast(`Submission verified — scholar is ${scholarFor(submission).status}.`);
}

$('#scholar-form').addEventListener('submit', event => {
  event.preventDefault(); const id = $('#scholar-id').value, studentId = $('#student-id').value.trim();
  const duplicate = data.scholars.find(s => s.studentId.toLowerCase() === studentId.toLowerCase() && s.id !== id);
  if (duplicate) { $('#scholar-error').textContent = 'Student ID must be unique.'; return; }
  const current = data.scholars.find(s => s.id === id);
  const record = { id: id || uid('s'), studentId, name: $('#scholar-name').value.trim(), degree: $('#degree-program').value.trim(), year: $('#year-level').value, programId: $('#scholar-program').value, status: current?.status || 'Active' };
  if (current) Object.assign(current, record); else data.scholars.push(record); save(); renderAll(); closeModals(); $('#scholar-modal-title').textContent = 'Register Scholar'; toast(current ? 'Scholar record updated.' : 'Scholar registered successfully.');
});

$('#program-form').addEventListener('submit', event => {
  event.preventDefault(); data.programs.push({ id: uid('p'), name: $('#program-name').value.trim(), gwa: Number($('#required-gwa').value), units: Number($('#min-units').value), allowFailing: $('#allow-failing').checked }); save(); renderAll(); closeModals(); event.target.reset(); toast('Scholarship program saved.');
});

$('#submission-form').addEventListener('submit', event => {
  event.preventDefault(); const submission = { id: uid('g'), scholarId: $('#submission-scholar').value, year: $('#academic-year').value.trim(), semester: $('#semester').value, gwa: Number($('#submission-gwa').value), units: Number($('#units-enrolled').value), failed: Number($('#failed-subjects').value), incomplete: Number($('#incomplete-subjects').value), status: 'Pending', submittedAt: new Date().toISOString() };
  data.submissions.push(submission); const scholar = scholarFor(submission); if (scholar.status === 'Active') scholar.status = 'Pending Submission'; save(); renderAll(); closeModals(); event.target.reset(); toast('Grade submission saved as Pending.');
});

['#scholar-search', '#scholar-filter', '#status-filter'].forEach(id => $(id).addEventListener(id === '#scholar-search' ? 'input' : 'change', renderScholars));
$('#submission-filter').addEventListener('change', renderSubmissions);

function configuredSupabase() {
  return window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes('PASTE_') && !window.SUPABASE_ANON_KEY.includes('PASTE_');
}

function setAuthMode(mode) {
  const signingUp = mode === 'signup';
  $('#login-form').classList.toggle('hidden', signingUp);
  $('#signup-form').classList.toggle('hidden', !signingUp);
  $('#auth-title').textContent = signingUp ? 'Create Staff Account' : 'Staff Login';
  $('#auth-description').textContent = signingUp ? 'Create your account first, then an administrator can grant staff access.' : 'Sign in to manage scholar records and academic compliance.';
  $('#auth-switch').innerHTML = signingUp ? 'Already have an account? <button type="button" data-auth-mode="login">Log in</button>' : 'No account yet? <button type="button" data-auth-mode="signup">Create one</button>';
  $('#login-error').textContent = ''; $('#signup-error').textContent = '';
}

function showLogin(error = '') {
  closeModals();
  $('#auth-screen').classList.remove('hidden');
  $('.app-shell').classList.remove('authenticated');
  setAuthMode('login');
  $('#login-error').textContent = error;
}

async function enterPortal(user) {
  const { data: profile, error } = await supabaseClient.from('profiles').select('full_name, role').eq('id', user.id).single();
  if (error || !profile) {
    await supabaseClient.auth.signOut();
    showLogin('Your user profile could not be found. Please contact the system administrator.');
    return;
  }
  if (!['admin', 'staff'].includes(profile.role)) {
    await supabaseClient.auth.signOut();
    showLogin('Your account was created, but it is not yet Staff/Admin. Run the role-promotion SQL, then log in again.');
    return;
  }
  $('#user-name').textContent = profile.full_name;
  $('#user-role').textContent = profile.role === 'admin' ? 'System Administrator' : 'Scholarship Staff';
  $('#user-initials').textContent = initials(profile.full_name);
  $('#auth-screen').classList.add('hidden');
  $('.app-shell').classList.add('authenticated');
  renderAll();
}

async function bootAuth() {
  if (!configuredSupabase()) {
    $('#auth-setup').textContent = 'Setup needed: open config.js and paste your Supabase Project URL and anon key first.';
    return;
  }
  if (!window.supabase) {
    $('#auth-setup').textContent = 'Unable to load Supabase. Check your internet connection and reload the page.';
    return;
  }
  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await enterPortal(session.user);
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient) { $('#login-error').textContent = 'Add the Supabase URL and anon key in config.js first.'; return; }
  const button = event.submitter; button.disabled = true; button.textContent = 'Logging in…';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
  button.disabled = false; button.textContent = 'Log In';
  if (error) { $('#login-error').textContent = error.message; return; }
  await enterPortal(data.user);
});

$('#signup-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient) { $('#signup-error').textContent = 'Add the Supabase URL and anon key in config.js first.'; return; }
  const button = event.submitter; button.disabled = true; button.textContent = 'Creating…';
  const { data, error } = await supabaseClient.auth.signUp({
    email: $('#signup-email').value.trim(), password: $('#signup-password').value,
    options: { data: { full_name: $('#signup-name').value.trim() } }
  });
  button.disabled = false; button.textContent = 'Create Account';
  if (error) { $('#signup-error').textContent = error.message; return; }
  event.target.reset();
  $('#signup-error').style.color = '#157a54';
  $('#signup-error').textContent = data.session ? 'Account created. Ask the administrator to promote your role to Staff/Admin, then log in.' : 'Account created. Check your email to confirm it, then ask the administrator to promote your role.';
});

$('#logout-button').addEventListener('click', async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  showLogin('You have been logged out.');
});

document.addEventListener('click', event => {
  const switcher = event.target.closest('[data-auth-mode]');
  if (switcher) setAuthMode(switcher.dataset.authMode);
});

bootAuth();
