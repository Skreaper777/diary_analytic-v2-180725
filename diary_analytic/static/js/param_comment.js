// --- Логика для редактирования комментариев параметров ---
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.param-description-textarea').forEach(textarea => {
    const paramKey = textarea.closest('.param-description-block').dataset.paramKey;
    const saveBtn = textarea.parentElement.querySelector('.save-description-btn');
    const statusDiv = textarea.parentElement.querySelector('.save-description-status');
    let lastValue = textarea.value;
    textarea.addEventListener('input', function() {
      if (textarea.value !== lastValue) {
        saveBtn.style.display = 'inline-block';
        statusDiv.style.display = 'none';
      } else {
        saveBtn.style.display = 'none';
      }
    });
    saveBtn.addEventListener('click', function() {
      fetch('/api/set_parameter_description/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: paramKey, description: textarea.value })
      })
      .then(resp => resp.json())
      .then(data => {
        if (data.success) {
          lastValue = textarea.value;
          saveBtn.style.display = 'none';
          statusDiv.style.display = 'block';
          setTimeout(() => { statusDiv.style.display = 'none'; }, 1500);
        }
      });
    });
  });
}); 