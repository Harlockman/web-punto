// ... (Tus importaciones de Firebase arriba)

async function loadData() {
    const snap = await getDocs(collection(db, "catalogo"));
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Organizar por Anime automáticamente
    allItems = allItems.map(item => {
        if (item.isAnime || (item.genre_ids && item.genre_ids.includes(16))) {
            item.category = "Anime";
        }
        return item;
    });

    renderHero();
    renderGrid('all');
}

function renderHero() {
    const hero = document.getElementById('hero');
    if (!hero || allItems.length === 0) return;
    
    const pick = allItems[Math.floor(Math.random() * allItems.length)];
    hero.style.backgroundImage = `url(${pick.backdrop || pick.poster})`;
    hero.innerHTML = `
        <div class="hero-content">
            <h1 style="font-size: 3rem; font-family: 'Bebas Neue';">${pick.title}</h1>
            <p style="margin: 15px 0; font-size: 14px; color: #ccc;">${pick.plot ? pick.plot.substring(0, 150) + '...' : ''}</p>
            <button class="btn-main" style="padding: 10px 25px; background: #fff; color: #000; border: none; font-weight: bold; cursor: pointer; border-radius: 4px;">▶ Ver ahora</button>
        </div>
    `;
}

function renderGrid(filter) {
    const container = document.getElementById('catalog-container');
    container.innerHTML = "";

    const categories = (filter === 'all') ? ['Peliculas', 'Series', 'Anime'] : [filter];

    categories.forEach(cat => {
        const list = allItems.filter(i => i.category === cat);
        if (list.length === 0) return;

        let html = `<div class="section-title">${cat}</div><div class="grid">`;
        list.forEach(item => {
            const label = (item.category === 'Series' || item.category === 'Anime' && item.seasons > 1) 
                          ? `${item.seasons} Temp` : item.year;
            
            html += `
                <div class="card">
                    <span class="badge">${label}</span>
                    <img src="${item.poster}" alt="${item.title}">
                    <div class="card-info">${item.title}</div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
}

// Vincula las funciones al objeto window para que los botones del HTML funcionen
window.filterCat = (el, cat) => {
    document.querySelectorAll('.n-link').forEach(l => l.classList.remove('active'));
    if(el) el.classList.add('active');
    renderGrid(cat);
};