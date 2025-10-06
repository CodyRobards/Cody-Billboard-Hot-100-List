(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const tables = Array.from(document.querySelectorAll<HTMLTableElement>("[data-sortable='true']"));
  if (!tables.length) {
    return;
  }

  tables.forEach((table) => {
    const body = table.tBodies[0];
    if (!body) return;

    const sortButtons = Array.from(
      table.querySelectorAll<HTMLButtonElement>('.ranking-table__sort[data-sort-key]')
    );

    const resetSortState = () => {
      sortButtons.forEach((button) => {
        const header = button.closest('th');
        header?.setAttribute('aria-sort', 'none');
      });
    };

    sortButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.sortKey;
        if (!key) return;

        const type = button.dataset.sortType ?? 'string';
        const current = button.getAttribute('aria-sort') ?? 'none';
        const nextDirection = current === 'ascending' ? 'descending' : 'ascending';

        resetSortState();
        const header = button.closest('th');
        header?.setAttribute('aria-sort', nextDirection);

        const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>('tr'));
        const multiplier = nextDirection === 'ascending' ? 1 : -1;

        rows.sort((a, b) => {
          const aCell = a.querySelector<HTMLElement>(`[data-sort-${key}]`);
          const bCell = b.querySelector<HTMLElement>(`[data-sort-${key}]`);
          const fallback = '';
          const aValue = aCell?.dataset.sortValue ?? aCell?.textContent?.trim() ?? fallback;
          const bValue = bCell?.dataset.sortValue ?? bCell?.textContent?.trim() ?? fallback;

          if (type === 'number') {
            const aNumber = Number(aValue);
            const bNumber = Number(bValue);
            return (aNumber - bNumber) * multiplier;
          }

          return aValue.localeCompare(bValue, undefined, { sensitivity: 'base' }) * multiplier;
        });

        rows.forEach((row) => body.appendChild(row));
      });
    });
  });
})();
