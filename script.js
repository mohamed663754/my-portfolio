// Wait for the DOM to be fully loaded
window.addEventListener('load', () => {
    // Hide Preloader
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.classList.add('fade-out');
    }
    
    // Initialize Digital Globe with Continent Details
    if (typeof THREE !== 'undefined') {
        initDetailedDigitalGlobe();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Header & Scroll
    const header = document.getElementById('header');
    const progressBar = document.querySelector('.progress-bar');
    window.addEventListener('scroll', () => {
        header?.classList.toggle('scrolled', window.scrollY > 50);
        const scrolled = (window.scrollY / (document.documentElement.scrollHeight - document.documentElement.clientHeight)) * 100;
        if (progressBar) progressBar.style.width = scrolled + '%';
    });

    // Custom Cursor
    const cursor = document.querySelector('.cursor');
    const follower = document.querySelector('.cursor-follower');
    document.addEventListener('mousemove', (e) => {
        if (cursor) { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }
        if (follower) { follower.style.left = e.clientX + 'px'; follower.style.top = e.clientY + 'px'; }
    });

    const links = document.querySelectorAll('a, button, .project-card, .skill-card, .logo');
    links.forEach(link => {
        link.addEventListener('mouseenter', () => follower?.classList.add('active'));
        link.addEventListener('mouseleave', () => follower?.classList.remove('active'));
    });

    // Magnetic Buttons
    document.querySelectorAll('.magnetic').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) * 0.3;
            const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
            btn.style.transform = `translate(${x}px, ${y}px)`;
        });
        btn.addEventListener('mouseleave', () => btn.style.transform = `translate(0, 0)`);
    });

    // Reveal Logic
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-zoom').forEach(el => revealObserver.observe(el));
});

// Digital Detailed Globe Function
function initDetailedDigitalGlobe() {
    const container = document.getElementById('globe-container');
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 2.8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // 1. Inner Sphere (Subtle Glow)
    const innerGeo = new THREE.SphereGeometry(0.98, 64, 64);
    const innerMat = new THREE.MeshBasicMaterial({
        color: 0x8B5CF6,
        transparent: true,
        opacity: 0.05,
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    globeGroup.add(innerSphere);

    // 2. Loading the Map for Continent Details
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    
    // Using a map to sample continent points
    const mapImage = new Image();
    mapImage.crossOrigin = "anonymous";
    mapImage.src = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg';
    
    mapImage.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = mapImage.width;
        canvas.height = mapImage.height;
        ctx.drawImage(mapImage, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const pointsGeo = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const color = new THREE.Color(0x06B6D4);
        const secondaryColor = new THREE.Color(0x8B5CF6);

        // Sample points based on map brightness
        const step = 8; // Adjust density
        for (let y = 0; y < canvas.height; y += step) {
            for (let x = 0; x < canvas.width; x += step) {
                const index = (y * canvas.width + x) * 4;
                const brightness = data[index]; // Red channel as brightness
                
                if (brightness > 60) { // If it's land
                    const lat = (y / canvas.height) * Math.PI - Math.PI / 2;
                    const lon = (x / canvas.width) * 2 * Math.PI - Math.PI;

                    const px = -Math.cos(lat) * Math.cos(lon);
                    const py = -Math.sin(lat);
                    const pz = Math.cos(lat) * Math.sin(lon);

                    positions.push(px, py, pz);
                    
                    // Gradient colors for continents
                    const mixedColor = color.clone().lerp(secondaryColor, Math.random() * 0.5);
                    colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
                }
            }
        }

        pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        pointsGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const pointsMat = new THREE.PointsMaterial({
            size: 0.012,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const continentPoints = new THREE.Points(pointsGeo, pointsMat);
        globeGroup.add(continentPoints);
        
        // Add subtle animation to points
        function animatePoints() {
            const time = Date.now() * 0.002;
            pointsMat.size = 0.012 + Math.sin(time) * 0.002;
            requestAnimationFrame(animatePoints);
        }
        animatePoints();
    };

    // 3. Atmosphere Ring
    const ringGeo = new THREE.TorusGeometry(1.3, 0.002, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.2 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    globeGroup.add(ring);

    // Interaction
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    container.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mouseup', () => isDragging = false);
    container.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.offsetX - previousMousePosition.x;
            const deltaY = e.offsetY - previousMousePosition.y;
            globeGroup.rotation.y += deltaX * 0.005;
            globeGroup.rotation.x += deltaY * 0.005;
        }
        previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        if (!isDragging) globeGroup.rotation.y += 0.0015;
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    animate();
}
