// Wait for the DOM to be fully loaded
window.addEventListener('load', () => {
    hidePreloader();
});

// Fail-safe: Hide preloader after 3 seconds regardless of load state
setTimeout(() => {
    hidePreloader();
}, 3000);

function hidePreloader() {
    const preloader = document.getElementById('preloader');
    if (preloader && !preloader.classList.contains('fade-out')) {
        preloader.classList.add('fade-out');
        
        // Initialize Digital Globe after preloader starts fading
        if (typeof THREE !== 'undefined') {
            initDetailedDigitalGlobe();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Header & Scroll
    const header = document.getElementById('header');
    const progressBar = document.querySelector('.progress-bar');
    window.addEventListener('scroll', () => {
        header?.classList.toggle('scrolled', window.scrollY > 50);
        const scrolled = (window.scrollY / (document.documentElement.scrollHeight - document.documentElement.clientHeight)) * 100;
        if (progressBar) progressBar.style.width = scrolled + '%';
    });

    // Mobile Menu Toggle
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

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
    }, { threshold: 0.05 });
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

// =============================================
//   LIGHTWEIGHT INTERACTIVE BACKGROUND CANVAS
// =============================================
(function initBackgroundCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // alpha:false = faster compositing

    const C = [
        { r: 139, g: 92,  b: 246 },  // violet
        { r: 6,   g: 182, b: 212 },  // cyan
        { r: 236, g: 72,  b: 153 },  // pink
    ];

    let W, H, frame = 0;
    let mouse = { x: -9999, y: -9999 };
    let particles = [], streams = [];

    // ── Resize ───────────────────────────────
    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        build();
    }
    window.addEventListener('resize', resize);
    resize();

    // ── Mouse (throttled with flag) ───────────
    let mouseFrame = 0;
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    window.addEventListener('mouseleave', () => {
        mouse.x = -9999; mouse.y = -9999;
    });

    // ── Build scene ───────────────────────────
    function build() {
        // 28 particles → only ~378 connection checks vs 1485 with 55
        particles = Array.from({ length: 28 }, () => {
            const col = C[Math.floor(Math.random() * C.length)];
            return {
                x: Math.random() * W,  y: Math.random() * H,
                ox: 0, oy: 0,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r:  Math.random() * 2.5 + 1.5,
                phase: Math.random() * Math.PI * 2,
                freq:  Math.random() * 0.01 + 0.005,
                col,
            };
        });

        // 4 streams only (was 8)
        streams = Array.from({ length: 4 }, (_, i) => ({
            y:   (H / 4) * i + H / 8,
            t:   Math.random(),
            spd: Math.random() * 0.0006 + 0.0002,
            len: Math.random() * 0.2 + 0.08,
            col: C[i % 3],
            a:   0.07,
            wave: Math.random() * 0.01 + 0.004,
            wAmp: 25,
        }));
    }

    // ── Pre-compute aurora positions (slow drift, update every 3 frames) ──
    let auroraX = 0, auroraY = 0;
    function updateAurora() {
        auroraX = W * 0.5 + Math.sin(frame * 0.0018) * W * 0.12;
        auroraY = H * 0.42 + Math.cos(frame * 0.0013) * H * 0.08;
    }

    function drawAurora() {
        const r = Math.max(W, H) * 0.75;
        const g = ctx.createRadialGradient(auroraX, auroraY, 0, auroraX, auroraY, r);
        g.addColorStop(0,   'rgba(139,92,246,0.025)');
        g.addColorStop(0.4, 'rgba(6,182,212,0.01)');
        g.addColorStop(1,   'rgba(3,7,18,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    // ── Streams (straight lines — bezier curves removed) ─────────────────
    function drawStreams() {
        streams.forEach(s => {
            s.t += s.spd;
            if (s.t > 1 + s.len) s.t = -s.len;

            const x0 = (s.t - s.len) * W;
            const x1 =  s.t * W;
            const wy  = s.y + Math.sin(frame * s.wave) * s.wAmp;

            // Simple linear gradient (no bezier, no createLinearGradient per frame)
            ctx.beginPath();
            ctx.moveTo(x0, wy);
            ctx.lineTo(x1, wy);
            ctx.strokeStyle = `rgba(${s.col.r},${s.col.g},${s.col.b},${s.a})`;
            ctx.lineWidth   = 1;
            ctx.stroke();
        });
    }

    // ── Particles ─────────────────────────────
    const MOUSE_R  = 120;
    const MOUSE_R2 = MOUSE_R * MOUSE_R;      // squared — avoids sqrt
    const CONN_D   = 120;
    const CONN_D2  = CONN_D * CONN_D;        // squared check first

    function updateAndDrawParticles() {
        const len = particles.length;

        for (let i = 0; i < len; i++) {
            const p = particles[i];

            // Move
            p.x += p.vx;  p.y += p.vy;
            p.phase += p.freq;

            // Wrap
            if (p.x < -10) p.x = W + 10;
            else if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            else if (p.y > H + 10) p.y = -10;

            // Mouse repulsion — squared distance check first (avoids sqrt)
            const dxm = p.x - mouse.x;
            const dym = p.y - mouse.y;
            const dm2 = dxm * dxm + dym * dym;
            if (dm2 < MOUSE_R2 && dm2 > 0) {
                const dm    = Math.sqrt(dm2);
                const force = (1 - dm / MOUSE_R) * 45;
                p.ox += (dxm / dm) * force * 0.1;
                p.oy += (dym / dm) * force * 0.1;
            }
            p.ox *= 0.87;
            p.oy *= 0.87;

            const rx = p.x + p.ox;
            const ry = p.y + p.oy;
            const alpha = 0.55 + Math.sin(p.phase) * 0.2;

            // Single circle — NO RadialGradient (massive perf win)
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = `rgb(${p.col.r},${p.col.g},${p.col.b})`;
            ctx.beginPath();
            ctx.arc(rx, ry, p.r + Math.sin(p.phase) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawConnections() {
        const len = particles.length;
        for (let i = 0; i < len; i++) {
            const a = particles[i];
            const ax = a.x + a.ox, ay = a.y + a.oy;

            for (let j = i + 1; j < len; j++) {
                const b  = particles[j];
                const bx = b.x + b.ox, by = b.y + b.oy;
                const dx = ax - bx, dy = ay - by;
                const d2 = dx * dx + dy * dy;

                // Squared check to skip sqrt for distant pairs (major speedup)
                if (d2 > CONN_D2) continue;

                const d     = Math.sqrt(d2);
                const alpha = (1 - d / CONN_D) * 0.18;

                // Single color (no LinearGradient — way faster)
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
                ctx.strokeStyle = `rgba(${a.col.r},${a.col.g},${a.col.b},${alpha.toFixed(2)})`;
                ctx.lineWidth   = 0.6;
                ctx.stroke();
            }
        }
    }

    // ── Main Loop — throttled to ~30fps ───────
    function loop() {
        requestAnimationFrame(loop);
        frame++;

        // Skip odd frames → ~30fps rendering (halves GPU work)
        if (frame % 2 !== 0) return;

        // Fill background (solid, fast — alpha:false means no compositing)
        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, W, H);

        // Aurora: update position every 6 frames only
        if (frame % 6 === 0) updateAurora();
        drawAurora();

        drawStreams();
        drawConnections();
        updateAndDrawParticles();
    }


    loop();
})();


