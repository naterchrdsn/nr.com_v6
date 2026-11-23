(() => {
  'use strict';
  const root = document.querySelector('.constellation');
  const map = root.querySelector('.map');
  const links = [...map.querySelectorAll('.destination')];
  const status = root.querySelector('#status');
  let drag = null;
  const help = document.createElement('span');
  help.id = 'star-drag-help';
  help.className = 'status';
  help.textContent = 'Drag to rearrange. Arrow keys move the star; Shift moves farther. Escape cancels a drag. The text beside each star opens its link.';
  root.append(help);
  const handles = links.map((link) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'star-handle';
    button.setAttribute('aria-label', `Move ${link.querySelector('strong').textContent} star`);
    button.setAttribute('aria-describedby', help.id);
    button.title = 'Drag star · arrow keys to move';
    map.append(button);
    return button;
  });
  function refresh() {
    const bounds = map.getBoundingClientRect();
    handles.forEach((button, i) => {
      const star = links[i].querySelector('.star').getBoundingClientRect();
      button.style.left = `${star.left + star.width / 2 - bounds.left - 17}px`;
      button.style.top = `${star.top + star.height / 2 - bounds.top - 17}px`;
    });
  }
  function move(index, x, y) {
    const link = links[index];
    const bounds = map.getBoundingClientRect();
    const current = link.getBoundingClientRect();
    const mobile = innerWidth < 1100;
    const minX = Math.max(8, 12 - bounds.left);
    const maxX = Math.min(bounds.width - current.width - 8, innerWidth - current.width - 12 - bounds.left);
    const footer = root.querySelector('.bottom');
    const maxY = mobile ? bounds.height - current.height - 8 : footer.getBoundingClientRect().top + parseFloat(getComputedStyle(footer).paddingTop) - bounds.top - current.height - 20;
    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(8, Math.min(maxY, y));
    const candidate = { left: bounds.left + x, top: bounds.top + y, right: bounds.left + x + current.width, bottom: bounds.top + y + current.height };
    const overlaps = (a, b) => a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8;
    if (overlaps(candidate, root.querySelector('.identity').getBoundingClientRect()) || links.some((other, i) => i !== index && overlaps(candidate, other.getBoundingClientRect()))) return false;
    link.style.left = `${x}px`;
    link.style.top = `${y}px`;
    dispatchEvent(new Event('scroll'));
    return true;
  }
  function finish(cancel = false) {
    if (!drag) return;
    const { index, pointer, left, top } = drag;
    drag = null;
    if (cancel) {
      links[index].style.left = `${left}px`;
      links[index].style.top = `${top}px`;
      dispatchEvent(new Event('scroll'));
    }
    const button = handles[index];
    button.classList.remove('dragging');
    if (button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
    status.textContent = cancel ? 'Star movement cancelled.' : 'Star repositioned. New sky resets the arrangement.';
  }
  handles.forEach((button, index) => {
    button.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0 || drag) return;
      event.preventDefault();
      button.focus({ preventScroll: true });
      drag = { index, pointer: event.pointerId, x: event.clientX, y: event.clientY, left: parseFloat(links[index].style.left), top: parseFloat(links[index].style.top) };
      button.setPointerCapture(event.pointerId);
      button.classList.add('dragging');
    });
    button.addEventListener('pointermove', (event) => {
      if (!drag || drag.index !== index || drag.pointer !== event.pointerId) return;
      move(index, drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
    });
    button.addEventListener('pointerup', (event) => { if (drag?.pointer === event.pointerId) finish(); });
    button.addEventListener('pointercancel', (event) => { if (drag?.pointer === event.pointerId) finish(true); });
    button.addEventListener('lostpointercapture', (event) => { if (drag?.pointer === event.pointerId) finish(); });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && drag?.index === index) { finish(true); return; }
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[event.key];
      if (!direction || drag) return;
      event.preventDefault();
      const step = event.shiftKey ? 24 : 8;
      const moved = move(index, parseFloat(links[index].style.left) + direction[0] * step, parseFloat(links[index].style.top) + direction[1] * step);
      status.textContent = moved ? 'Star repositioned.' : 'Keep stars clear of text and other links.';
    });
  });
  addEventListener('scroll', refresh, { passive: true });
  addEventListener('resize', () => { finish(); refresh(); });
  addEventListener('blur', () => finish(true));
  root.querySelector('#new-sky').addEventListener('click', () => { finish(); refresh(); });
  refresh();
})();
