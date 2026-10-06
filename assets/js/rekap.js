// ============================================
// rekap.js - Logic halaman rekap admin
// ============================================

let allRekap = [];
let currentUser = null;

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  
  // Cek role
  if (currentUser.role !== 'admin' && currentUser.role !== 'auditor') {
    alert('Akses ditolak. Halaman ini hanya untuk admin & auditor.');
    window.location.href = 'dashboard.html';
    return;
  }
  
  renderUserInfo();
  await loadRekap();
});

function renderUserInfo() {
  const el = document.getElementById('user-info');
  el.innerHTML = `
    <span style="opacity:0.9;">${escapeHtml(currentUser.nama)}</span>
    <span style="opacity:0.7;font-size:12px;"> • ${escapeHtml(currentUser.role)}</span>
  `;
  
  if (currentUser.role === 'admin') {
    const linkManage = document.getElementById('link-manage-user');
    if (linkManage) linkManage.style.display = 'inline';
  }
}

async function loadRekap() {
  const container = document.getElementById('table-container');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat data...</div>';
  
  const result = await callAPI('getRekap');
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  allRekap = result.data || [];
  
  document.getElementById('year-badge').textContent = 'Tahun ' + (result.tahun || '-');
  
  renderStats();
  renderRekap();
}

function renderStats() {
  const total = allRekap.length;
  const excellent = allRekap.filter(r => r.totalSkor >= 90).length;
  const good = allRekap.filter(r => r.totalSkor >= 70 && r.totalSkor < 90).length;
  const poor = allRekap.filter(r => r.totalSkor < 70).length;
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-excellent').textContent = excellent;
  document.getElementById('stat-good').textContent = good;
  document.getElementById('stat-poor').textContent = poor;
}

function renderRekap() {
  const container = document.getElementById('table-container');
  
  if (allRekap.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;">📭</div>
        <p>Tidak ada data rekap</p>
      </div>
    `;
    return;
  }
  
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();
  const skorFilter = document.getElementById('filter-skor').value;
  const sortFilter = document.getElementById('filter-sort').value;
  
  let filtered = allRekap.filter(r => {
    if (searchFilter && !r.subsatker.toLowerCase().includes(searchFilter)) return false;
    if (skorFilter === 'excellent' && r.totalSkor < 90) return false;
    if (skorFilter === 'good' && (r.totalSkor < 70 || r.totalSkor >= 90)) return false;
    if (skorFilter === 'poor' && r.totalSkor >= 70) return false;
    return true;
  });
  
  // Sort
  filtered.sort((a, b) => {
    if (sortFilter === 'skor-desc') return b.totalSkor - a.totalSkor;
    if (sortFilter === 'skor-asc') return a.totalSkor - b.totalSkor;
    if (sortFilter === 'nama') return a.subsatker.localeCompare(b.subsatker);
    if (sortFilter === 'progress') return b.persentase - a.persentase;
    return 0;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;">🔍</div>
        <p>Tidak ada data yang cocok dengan filter</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <table>
      <thead>
        <tr>
          <th style="width:50px;">No</th>
          <th>Subsatker</th>
          <th style="width:120px;text-align:center;">Progress</th>
          <th style="width:90px;text-align:center;">Skor A</th>
          <th style="width:90px;text-align:center;">Skor B</th>
          <th style="width:100px;text-align:center;">Total</th>
          <th style="width:120px;text-align:center;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach((r, index) => {
    const percent = r.persentase;
    const progressColor = percent >= 90 ? '#059669' : percent >= 70 ? '#d97706' : '#dc2626';
    
    let statusBadge;
    if (r.totalSkor >= 90) {
      statusBadge = '<span class="badge badge-success">✅ Excellent</span>';
    } else if (r.totalSkor >= 70) {
      statusBadge = '<span class="badge badge-warning">⚠️ Good</span>';
    } else {
      statusBadge = '<span class="badge badge-danger">❌ Perlu Perbaikan</span>';
    }
    
    html += `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(r.subsatker)}</strong></td>
        <td style="text-align:center;">
          <span style="color:${progressColor};font-weight:600;">${r.tersedia}/${r.total}</span>
          <div style="font-size:11px;color:#6b7280;">${percent}%</div>
        </td>
        <td style="text-align:center;">${r.skorA.toFixed(1)}</td>
        <td style="text-align:center;">${r.skorB.toFixed(1)}</td>
        <td style="text-align:center;font-weight:700;font-size:15px;">${r.totalSkor.toFixed(1)}</td>
        <td style="text-align:center;">${statusBadge}</td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function exportCSV() {
  if (allRekap.length === 0) {
    showToast('Tidak ada data untuk di-export', 'error');
    return;
  }
  
  const headers = ['No', 'Subsatker', 'Tersedia', 'Total', 'Persentase', 'Skor A', 'Skor B', 'Total Skor'];
  const rows = allRekap.map((r, i) => [
    i + 1,
    r.subsatker,
    r.tersedia,
    r.total,
    r.persentase + '%',
    r.skorA.toFixed(2),
    r.skorB.toFixed(2),
    r.totalSkor.toFixed(2)
  ]);
  
  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'rekap_iso_' + new Date().toISOString().slice(0,10) + '.csv';
  link.click();
  
  showToast('✅ CSV berhasil di-download');
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}