// --- Логика для переименования параметра ---
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.parameter-block').forEach(block => {
    const editBtn = block.querySelector('.edit-param-btn');
    const modal = block.querySelector('.rename-modal');
    const nameInput = block.querySelector('.rename-param-name');
    const saveBtn = block.querySelector('.save-rename-btn');
    const cancelBtn = block.querySelector('.cancel-rename-btn');
    const errorDiv = block.querySelector('.rename-error');
    if (!editBtn || !modal) return;
    editBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      modal.style.display = 'flex';
      nameInput.value = block.querySelector('.rename-param-name').defaultValue;
      errorDiv.style.display = 'none';
    });
    cancelBtn.addEventListener('click', function() {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.style.display = 'none';
    });
    saveBtn.addEventListener('click', async function() {
      const oldKey = block.getAttribute('data-key');
      const newName = nameInput.value.trim();
      if (!newName) {
        errorDiv.textContent = 'Заполните новое название';
        errorDiv.style.display = 'block';
        return;
      }
      saveBtn.disabled = true;
      errorDiv.style.display = 'none';
      try {
        const resp = await fetch('/api/rename_parameter/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_key: oldKey, new_name: newName })
        });
        const data = await resp.json();
        if (data.success) {
          window.location.reload();
        } else {
          errorDiv.textContent = data.error || 'Ошибка';
          errorDiv.style.display = 'block';
        }
      } catch (e) {
        errorDiv.textContent = 'Ошибка соединения';
        errorDiv.style.display = 'block';
      }
      saveBtn.disabled = false;
    });
  });
}); 