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
//   ELEGANT INTERACTIVE BACKGROUND CANVAS
// =============================================
(function initBackgroundCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── Palette ──────────────────────────────
    const C = {
        violet: { r: 139, g: 92,  b: 246 },
        cyan:   { r: 6,   g: 182, b: 212 },
        pink:   { r: 236, g: 72,  b: 153 },
    };
    const CKEYS = Object.keys(C);

    // ── State ────────────────────────────────
    let W, H, frame = 0;
    let mouse = { x: -9999, y: -9999 };  // off screen initially
    let particles = [], streams = [];

    // ── Resize ───────────────────────────────
    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        build();
    }
    window.addEventListener('resize', resize);
    resize();

    // ── Track Mouse ──────────────────────────
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    window.addEventListener('mouseleave', () => {
        mouse.x = -9999;
        mouse.y = -9999;
    });

    // ── Helpers ──────────────────────────────
    function rc() { return C[CKEYS[Math.floor(Math.random() * CKEYS.length)]]; }
    function rgba(c, a) { return `rgba(${c.r},${c.g},${c.b},${+a.toFixed(3)})`; }

    // ── Build Scene ──────────────────────────
    function build() {
        // Elegant, fewer particles — quality over quantity
        particles = Array.from({ length: 55 }, () => {
            const col = rc();
            return {
                x:    Math.random() * W,
                y:    Math.random() * H,
                ox:   0, oy: 0,          // offset from mouse push
                vx:   (Math.random() - 0.5) * 0.25,
                vy:   (Math.random() - 0.5) * 0.25,
                r:    Math.random() * 2 + 1,
                glow: Math.random() * 14 + 8,
                phase: Math.random() * Math.PI * 2,
                freq:  Math.random() * 0.012 + 0.006,
                col,
            };
        });

        // Elegant flowing streams (horizontal with gentle wave)
        streams = Array.from({ length: 8 }, (_, i) => ({
            y:    (H / 8) * i + H / 16,
            t:    Math.random(),          // normalized progress 0–1
            spd:  Math.random() * 0.0008 + 0.0003,
            len:  Math.random() * 0.22 + 0.08,
            col:  rc(),
            a:    Math.random() * 0.12 + 0.04,
            wave: Math.random() * 0.015 + 0.005,
            wAmp: Math.random() * 40 + 15,
        }));
    }

    // ── Draw: Soft Aurora ────────────────────
    function drawAurora() {
        // Slow-drifting radial glow
        const cx = W * 0.5 + Math.sin(frame * 0.0018) * W * 0.12;
        const cy = H * 0.42 + Math.cos(frame * 0.0013) * H * 0.08;
        const r  = Math.max(W, H) * 0.75;
        const pulse = 0.022 + Math.sin(frame * 0.009) * 0.006;

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0,   `rgba(139,92,246,${pulse})`);
        g.addColorStop(0.35,`rgba(6,182,212,${pulse * 0.45})`);
        g.addColorStop(0.7, `rgba(236,72,153,${pulse * 0.15})`);
        g.addColorStop(1,   'rgba(3,7,18,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // Secondary smaller orb opposite side
        const cx2 = W * 0.75 + Math.cos(frame * 0.0021) * W * 0.08;
        const cy2 = H * 0.65 + Math.sin(frame * 0.0017) * H * 0.07;
        const r2  = Math.max(W, H) * 0.4;
        const g2  = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
        g2.addColorStop(0,  `rgba(6,182,212,${pulse * 0.6})`);
        g2.addColorStop(1,  'rgba(3,7,18,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);
    }

    // ── Draw: Flowing Streams ─────────────────
    function drawStreams() {
        streams.forEach(s => {
            s.t += s.spd;
            if (s.t > 1 + s.len) s.t = -s.len;

            const x0 = (s.t - s.len) * W;
            const x1 =  s.t * W;
            const wy  = s.y + Math.sin(frame * s.wave + s.y * 0.008) * s.wAmp;

            const g = ctx.createLinearGradient(x0, wy, x1, wy);
            g.addColorStop(0,   rgba(s.col, 0));
            g.addColorStop(0.35,rgba(s.col, s.a));
            g.addColorStop(0.65,rgba(s.col, s.a * 0.7));
            g.addColorStop(1,   rgba(s.col, 0));

            ctx.beginPath();
            ctx.moveTo(x0, wy);
            // Bezier curve for elegance
            const cx = (x0 + x1) / 2;
            ctx.quadraticCurveTo(cx, wy + Math.sin(frame * 0.01) * 12, x1, wy);
            ctx.strokeStyle = g;
            ctx.lineWidth   = 1.2;
            ctx.stroke();
        });
    }

    // ── Draw: Particles + Connections ─────────
    const MOUSE_RADIUS   = 130;   // repulsion zone
    const MOUSE_STRENGTH = 55;    // how far they get pushed
    const CONNECT_DIST   = 140;

    function drawParticles() {
        particles.forEach(p => {
            // Base movement
            p.x += p.vx;
            p.y += p.vy;
            p.phase += p.freq;

            // Wrap
            if (p.x < -20) p.x = W + 20;
            if (p.x > W + 20) p.x = -20;
            if (p.y < -20) p.y = H + 20;
            if (p.y > H + 20) p.y = -20;

            // Mouse repulsion with spring return
            const dxm = p.x - mouse.x;
            const dym = p.y - mouse.y;
            const dm  = Math.sqrt(dxm * dxm + dym * dym);
            if (dm < MOUSE_RADIUS && dm > 0) {
                const force = (1 - dm / MOUSE_RADIUS) * MOUSE_STRENGTH;
                p.ox += (dxm / dm) * force * 0.12;
                p.oy += (dym / dm) * force * 0.12;
            }
            // Spring return to (0,0) offset
            p.ox *= 0.88;
            p.oy *= 0.88;

            const rx = p.x + p.ox;
            const ry = p.y + p.oy;

            // Breathing pulse
            const pulse = p.r + Math.sin(p.phase) * 0.6;
            const alpha = 0.45 + Math.sin(p.phase) * 0.25;

            // Soft outer glow
            const glow = p.glow + Math.sin(p.phase * 0.7) * 3;
            const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, glow);
            grad.addColorStop(0, rgba(p.col, alpha * 0.45));
            grad.addColorStop(0.5, rgba(p.col, alpha * 0.1));
            grad.addColorStop(1, rgba(p.col, 0));
            ctx.beginPath();
            ctx.arc(rx, ry, glow, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(rx, ry, pulse, 0, Math.PI * 2);
            ctx.fillStyle = rgba(p.col, alpha + 0.15);
            ctx.fill();
        });
    }

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a  = particles[i], b = particles[j];
                const ax = a.x + a.ox,  ay = a.y + a.oy;
                const bx = b.x + b.ox,  by = b.y + b.oy;
                const dx = ax - bx, dy = ay - by;
                const d  = Math.sqrt(dx * dx + dy * dy);

                if (d < CONNECT_DIST) {
                    const t = 1 - d / CONNECT_DIST;
                    const alpha = t * t * 0.2;   // quadratic falloff = elegant fade

                    // Gradient line between the two particle colors
                    const gl = ctx.createLinearGradient(ax, ay, bx, by);
                    gl.addColorStop(0, rgba(a.col, alpha));
                    gl.addColorStop(1, rgba(b.col, alpha));

                    ctx.beginPath();
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(bx, by);
                    ctx.strokeStyle = gl;
                    ctx.lineWidth   = t * 0.8;   // thinner = more elegant
                    ctx.stroke();
                }
            }
        }
    }

    // ── Main Loop ─────────────────────────────
    function loop() {
        frame++;

        // Subtle trail (lower = more trail = dreamier look)
        ctx.fillStyle = 'rgba(3, 7, 18, 0.18)';
        ctx.fillRect(0, 0, W, H);

        drawAurora();
        drawStreams();
        drawConnections();
        drawParticles();

        requestAnimationFrame(loop);
    }

    loop();
})();

