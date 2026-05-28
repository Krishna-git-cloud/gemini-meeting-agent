/* ─────────────────────────────────────────────
   MeetingMind v3 — JS
   ───────────────────────────────────────────── */

const SAMPLE = `Meeting Date: Oct 24th
Attendees: Sarah (Marketing), John (Engineering), Mike (Product), Emily (Design)

Notes:
- Sarah mentioned the Q3 marketing budget is delayed by about 2 weeks. We can't spend anything on paid ads right now.
- John needs to send the revised estimates for the server migration by Thursday EOD. He said it's 80% done.
- We agreed to pause the new social media ad campaign until Emily's new graphics are ready (should be next Monday).
- Mike brought up the client feedback on the dashboard. They want an export to CSV button. We decided to put that in the next sprint.
- Action item for Mike to create a Jira ticket for the CSV export feature - should be HIGH priority.
- General consensus: the team feels a bit stretched thin. Sprint load may need to be reduced.
- Next team check-in should be scheduled for end of week (Friday) to review John's estimates and Emily's progress.`;

// ── Refs ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const ta         = $('notes-ta');
const charCount  = $('char-count');
const analyzeBtn = $('analyze-btn');
const loadMsg    = $('load-msg');
const errBar     = $('err-bar');
const errText    = $('err-text');
const results    = $('results');

// Stats
const snScore    = $('sn-score');
const snInsights = $('sn-insights');
const snActions  = $('sn-actions');
const snTopics   = $('sn-topics');
const statTs     = $('stat-ts');

// Topic chips
const chipsRow   = $('chips-row');
const chips      = $('chips');

// Vibe
const moodText   = $('mood-text');
const ringArc    = $('ring-arc');
const ringN      = $('ring-n');
const rgs1       = $('rg-s1');
const rgs2       = $('rg-s2');
const scoreReason= $('score-reason');
const nextStepTxt= $('next-step-text');

// Insights
const insightsOl  = $('insights-ol');
const insightsBadge=$('insights-badge');

// Actions
const actionsUl   = $('actions-ul');
const actionsBadge= $('actions-badge');
const filterBtns  = document.querySelectorAll('.f-btn');

// Email
const emailTo    = $('email-to');
const emailSubj  = $('email-subject');
const emailBody  = $('email-body');
const copyEmailBtn=$('copy-email-btn');
const copyLbl    = $('copy-lbl');
const exportMdBtn= $('export-md-btn');
const mdLbl      = $('md-lbl');

// Cards for stagger
const allCards = ['card-vibe','card-insights','card-actions','card-email'].map($);

// ── Utils ─────────────────────────────────────────────────────
const show = el => { el.hidden = false };
const hide = el => { el.hidden = true };

// ── Char counter ──────────────────────────────────────────────
ta.addEventListener('input', () => {
  const n = ta.value.length;
  charCount.textContent = `${n.toLocaleString()} chars`;
  charCount.style.color = n > 4000 ? 'var(--amber)' : '';
});

// ── Sample / Clear ────────────────────────────────────────────
$('load-sample-btn').addEventListener('click', () => {
  ta.value = SAMPLE;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
});
$('clear-btn').addEventListener('click', () => {
  ta.value = '';
  ta.dispatchEvent(new Event('input'));
  ta.focus();
});

// ── Filter buttons ────────────────────────────────────────────
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.f;
    document.querySelectorAll('.a-item').forEach(li => {
      li.classList.toggle('hidden', f !== 'all' && li.dataset.prio !== f);
    });
  });
});

// ── Score ring ────────────────────────────────────────────────
function animateRing(score) {
  const circ = 251.3; // 2π×40
  const offset = circ - (score / 10) * circ;
  // colour stops by score range
  const [c1, c2] =
    score >= 8 ? ['#34d399','#38bdf8'] :
    score >= 6 ? ['#a78bfa','#38bdf8'] :
    score >= 4 ? ['#fbbf24','#f97316'] :
                 ['#f87171','#ef4444'];
  rgs1.setAttribute('stop-color', c1);
  rgs2.setAttribute('stop-color', c2);
  // animate on next frame
  requestAnimationFrame(() => { ringArc.style.strokeDashoffset = offset; });
}

// ── Copy helpers ──────────────────────────────────────────────
async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return; } catch {}
  // fallback
  const d = document.createElement('textarea');
  d.value = text; d.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(d); d.select();
  document.execCommand('copy'); document.body.removeChild(d);
}

function flashCopied(btn, lbl, msg) {
  lbl.textContent = msg;
  btn.classList.add('copied');
  setTimeout(() => {
    lbl.textContent = btn === copyEmailBtn ? 'Copy Email' : 'Export MD';
    btn.classList.remove('copied');
  }, 2000);
}

copyEmailBtn.addEventListener('click', () => {
  const txt = `To: ${emailTo.textContent}\nSubject: ${emailSubj.textContent}\n\n${emailBody.textContent}`;
  copyToClipboard(txt);
  flashCopied(copyEmailBtn, copyLbl, 'Copied!');
});

exportMdBtn.addEventListener('click', () => {
  const insLines = [...insightsOl.querySelectorAll('li')].map(
    (li,i) => `${i+1}. ${li.querySelector('.ins-text').textContent}`
  ).join('\n');
  const actLines = [...actionsUl.querySelectorAll('.a-item')].map(li => {
    const owner = li.querySelector('.a-owner')?.textContent || '';
    const prio  = li.querySelector('.a-prio')?.textContent || '';
    const due   = li.querySelector('.a-due span:last-child')?.textContent || '';
    const task  = li.querySelector('.a-task').textContent;
    return `- **[${prio}]** ${task} — *${owner}${due ? ', ' + due : ''}*`;
  }).join('\n');

  const md = [
    `# Meeting Notes — ${new Date().toLocaleDateString()}`,
    '',
    `## Mood\n${moodText.textContent}`,
    '',
    `## Key Insights\n${insLines}`,
    '',
    `## Action Items\n${actLines}`,
    '',
    `## Follow-Up\n${nextStepTxt.textContent}`,
    '',
    `## Email Draft`,
    `**To:** ${emailTo.textContent}`,
    `**Subject:** ${emailSubj.textContent}`,
    '',
    '```',
    emailBody.textContent,
    '```',
  ].join('\n');

  copyToClipboard(md);
  flashCopied(exportMdBtn, mdLbl, 'Copied!');
});

// ── Error ─────────────────────────────────────────────────────
function showErr(msg) {
  const overload = ['503','UNAVAILABLE','overloaded','high demand'].some(x => msg.includes(x));
  if (overload) msg = 'Gemini is under high demand — the server will auto-retry with fallback models. Please try again.';
  errText.textContent = msg;

  let btn = errBar.querySelector('.retry-btn');
  if (overload && !btn) {
    btn = Object.assign(document.createElement('button'), { className:'retry-btn', textContent:'Try Again' });
    btn.addEventListener('click', () => analyzeBtn.click());
    errBar.appendChild(btn);
  } else if (!overload && btn) btn.remove();

  show(errBar);
  errBar.scrollIntoView({ behavior:'smooth', block:'nearest' });
}
function hideErr() {
  hide(errBar);
  errBar.querySelector('.retry-btn')?.remove();
}

// ── Card stagger ──────────────────────────────────────────────
function showCards() {
  allCards.forEach((c, i) => c && setTimeout(() => c.classList.add('in'), i * 90));
}
function hideCards() {
  allCards.forEach(c => c?.classList.remove('in'));
}

// ── Render ────────────────────────────────────────────────────
function render(d) {
  const score   = Number(d.productivity_score) || 0;
  const insight = d.key_insights || [];
  const actions = d.action_items || [];
  const topics  = d.key_topics   || [];

  // Stats strip
  snScore.textContent    = score;
  snInsights.textContent = insight.length;
  snActions.textContent  = actions.length;
  snTopics.textContent   = topics.length;
  statTs.textContent     = `Generated ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;

  // Topic chips
  chips.innerHTML = '';
  if (topics.length) {
    topics.forEach((t, i) => {
      const s = document.createElement('span');
      s.className = 'chip';
      s.textContent = t;
      s.style.animationDelay = `${i * 55}ms`;
      chips.appendChild(s);
    });
    show(chipsRow);
  } else hide(chipsRow);

  // Mood
  moodText.textContent = d.meeting_mood || '—';

  // Score ring
  ringN.textContent = score;
  setTimeout(() => animateRing(score), 150);

  // Score meta
  scoreReason.textContent = d.productivity_reason || '';
  nextStepTxt.textContent = d.follow_up_suggestion || '';

  // Insights
  insightsOl.innerHTML = '';
  insightsBadge.textContent = `${insight.length} insight${insight.length !== 1 ? 's' : ''}`;
  insight.forEach((text, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="ins-num">${String(i+1).padStart(2,'0')}</span>
      <span class="ins-text">${text}</span>`;
    insightsOl.appendChild(li);
  });

  // Actions
  actionsUl.innerHTML = '';
  // reset filter
  filterBtns.forEach(b => b.classList.toggle('active', b.dataset.f === 'all'));
  actionsBadge.textContent = `${actions.length} item${actions.length !== 1 ? 's' : ''}`;

  actions.forEach((item, idx) => {
    const prio = item.priority || 'Medium';
    const li = document.createElement('li');
    li.className = `a-item prio-${prio}`;
    li.dataset.prio = prio;

    // checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'a-cb'; cb.id = `cb${idx}`;
    cb.addEventListener('change', () => li.classList.toggle('done-item', cb.checked));

    // body
    const body = document.createElement('div');
    body.className = 'a-body';

    // meta row
    const meta = document.createElement('div');
    meta.className = 'a-meta';
    if (item.owner) {
      const ow = document.createElement('span');
      ow.className = 'a-owner'; ow.textContent = item.owner;
      meta.appendChild(ow);
    }
    const pr = document.createElement('span');
    pr.className = `a-prio ${prio}`; pr.textContent = prio;
    meta.appendChild(pr);

    if (item.due_date) {
      const due = document.createElement('span');
      due.className = 'a-due';
      due.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>${item.due_date}</span>`;
      meta.appendChild(due);
    }

    const task = document.createElement('p');
    task.className = 'a-task'; task.textContent = item.task;

    body.appendChild(meta);
    body.appendChild(task);
    li.appendChild(cb);
    li.appendChild(body);
    actionsUl.appendChild(li);
  });

  // Email
  emailTo.textContent   = d.email_recipients || 'Team';
  emailSubj.textContent = d.email_subject    || '';
  emailBody.textContent = d.draft_email      || '';
}

// ── Loading step cycle ────────────────────────────────────────
const STEPS = ['Parsing notes…','Extracting insights…','Assigning tasks…','Drafting email…','Almost done…'];
let stepInterval;
function startSteps() {
  let i = 0; loadMsg.textContent = STEPS[0];
  stepInterval = setInterval(() => { loadMsg.textContent = STEPS[Math.min(++i, STEPS.length-1)]; }, 2000);
}
function stopSteps() { clearInterval(stepInterval); loadMsg.textContent = 'Analyzing…'; }

// ── Analyze ───────────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
  const notes = ta.value.trim();
  if (!notes) { showErr('Paste your meeting notes first.'); ta.focus(); return; }

  hideErr(); hideCards(); hide(results);

  analyzeBtn.disabled = true;
  $('ab-idle') && ($('ab-idle').hidden = false);
  analyzeBtn.querySelector('.ab-idle').hidden = true;
  analyzeBtn.querySelector('.ab-busy').hidden = false;
  startSteps();

  try {
    const res  = await fetch('/analyze', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    render(data);
    show(results);
    requestAnimationFrame(() => requestAnimationFrame(showCards));
    results.scrollIntoView({ behavior:'smooth', block:'start' });

  } catch(e) {
    showErr(`Analysis failed: ${e.message}`);
  } finally {
    stopSteps();
    analyzeBtn.disabled = false;
    analyzeBtn.querySelector('.ab-idle').hidden = false;
    analyzeBtn.querySelector('.ab-busy').hidden = true;
  }
});

// ── Ctrl/Cmd+Enter ────────────────────────────────────────────
ta.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') analyzeBtn.click();
});
