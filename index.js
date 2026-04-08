const React = Spicetify.React;

function VisualizadorProConfig() {
    const canvasRef = React.useRef(null);
    const audioDataRef = React.useRef({ segments: [], beats: [], loudnessHistory: [] });
    // Emergency fallback colors
    const colorBotRef = React.useRef({ r: 30, g: 215, b: 96 }); 
    const colorTopRef = React.useRef({ r: 255, g: 255, b: 255 });

    const [config, setConfig] = React.useState(() => {
        const saved = localStorage.getItem("viz_config");
        const defaultCfg = { 
            sensitivity: 1.0, friction: 0.85, tension: 0.08, 
            bars: 84, brightness: 150, delay: 0, 
            manual: false, hexBot: "#1db954", hexTop: "#ffffff",
            neon: true // Neon enabled by default
        };
        try { return saved ? { ...defaultCfg, ...JSON.parse(saved) } : defaultCfg; } catch (e) { return defaultCfg; }
    });

    // --- HELPER: HEX TO RGB ---
    const hexToRgb = (hex) => {
        hex = hex.replace('#', '');
        return {
            r: parseInt(hex.substring(0, 2), 16) || 0,
            g: parseInt(hex.substring(2, 4), 16) || 0,
            b: parseInt(hex.substring(4, 6), 16) || 0
        };
    };

    // --- EFFECT: WATCH CONFIG CHANGES ---
    React.useEffect(() => {
        localStorage.setItem("viz_config", JSON.stringify(config));
        if (config.manual) {
            colorBotRef.current = hexToRgb(config.hexBot);
            colorTopRef.current = hexToRgb(config.hexTop);
        } else {
            updateDynamicColor(); // Trigger auto extraction immediately
        }
    }, [config]);

    const updateDynamicColor = async () => {
        if (config.manual) return;

        try {
            const uri = Spicetify.Player.data?.item?.uri;
            if (!uri) return;

            const colors = await Spicetify.colorExtractor(uri).catch(() => null);
            
            if (colors && colors.vibrant) {
                const rgbBot = hexToRgb(colors.vibrant);
                colorBotRef.current = rgbBot;
                
                // Auto calculate a brighter, slightly desaturated Top color for nice gradient
                colorTopRef.current = {
                    r: Math.min(255, rgbBot.r + 100),
                    g: Math.min(255, rgbBot.g + 100),
                    b: Math.min(255, rgbBot.b + 100)
                };
            } else {
                // Fallback
                colorBotRef.current = { r: 30, g: 215, b: 96 };
                colorTopRef.current = { r: 255, g: 255, b: 255 };
            }
        } catch (e) {
            colorBotRef.current = { r: 30, g: 215, b: 96 };
            colorTopRef.current = { r: 255, g: 255, b: 255 };
        }
    };

    const fetchAudioData = async () => {
        const item = Spicetify.Player.data?.item;
        if (!item) return;
        updateDynamicColor();
        try {
            const data = await Spicetify.getAudioData(item.uri);
            audioDataRef.current = data ? { segments: data.segments || [], beats: data.beats || [], loudnessHistory: [] } : { segments: [], beats: [], loudnessHistory: [] };
        } catch (e) { audioDataRef.current = { segments: [], beats: [], loudnessHistory: [] }; }
    };

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Alpha false for better performance, but need to clear with fillRect
        const ctx = canvas.getContext('2d', { alpha: false });
        let animationId;
        let heights = new Array(200).fill(5), vels = new Array(200).fill(0);
        let lastT = performance.now(), internalClock = 0, lastP = 0;

        fetchAudioData();
        const onSongChange = () => fetchAudioData();
        Spicetify.Player.addEventListener("songchange", onSongChange);

        const renderLoop = (now) => {
            if (!canvas?.parentElement) { animationId = requestAnimationFrame(renderLoop); return; }
            
            if (canvas.width !== canvas.parentElement.clientWidth || canvas.height !== canvas.parentElement.clientHeight) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }

            ctx.fillStyle = '#121212';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const isPlaying = Spicetify.Player.isPlaying();
            const { segments, beats, loudnessHistory } = audioDataRef.current;
            const pProg = (Spicetify.Player.getProgress() || 0) / 1000;
            const dt = (now - lastT) / 1000;
            lastT = now;

            if (pProg !== lastP) { 
                internalClock += (pProg - internalClock) * 0.8; 
                lastP = pProg; 
            } else if (isPlaying) { 
                internalClock += dt; 
            }

            const exactTime = internalClock + (config.delay / 1000);
            const n = config.bars || 84;
            const mH = canvas.height * 0.75 * (config.sensitivity || 1.0);

            let tPitches = new Array(12).fill(0);
            let avgNormalizedVolume = 0; // Needed for dynamic neon

            if (isPlaying && segments && segments.length > 0) {
                const sIdx = segments.findIndex(s => exactTime >= s.start && exactTime < (s.start + s.duration));
                if (sIdx !== -1) {
                    const s1 = segments[sIdx], s2 = segments[sIdx + 1] || s1;
                    const ease = (1 - Math.cos(Math.max(0, Math.min(1, (exactTime - s1.start) / s1.duration)) * Math.PI)) / 2;
                    loudnessHistory.push(s1.loudness_max);
                    if (loudnessHistory.length > 100) loudnessHistory.shift();
                    const avgLoudness = Math.max(...loudnessHistory, -20);
                    
                    avgNormalizedVolume = Math.pow(Math.max(0, (s1.loudness_max + 60) / (avgLoudness + 60)), 2.5);
                    
                    const beat = beats.find(b => exactTime >= b.start && exactTime < (b.start + b.duration));
                    const bst = 1 + (beat ? Math.max(0, 1 - (exactTime - beat.start) / (beat.duration * 0.8)) : 0) * 0.9;
                    tPitches = s1.pitches.map((p, i) => ((p * (1 - ease)) + (s2.pitches[i] * ease)) * avgNormalizedVolume * bst);
                }
            }

            const cBot = colorBotRef.current;
            const cTop = colorTopRef.current;
            const brightness = config.brightness || 150;

            const grad = ctx.createLinearGradient(0, canvas.height - mH, 0, canvas.height);
            // Mix white into the top color based on the config brightness setting
            const finalTopR = Math.min(255, cTop.r + brightness);
            const finalTopG = Math.min(255, cTop.g + brightness);
            const finalTopB = Math.min(255, cTop.b + brightness);
            
            grad.addColorStop(0, `rgb(${finalTopR}, ${finalTopG}, ${finalTopB})`);
            grad.addColorStop(1, `rgb(${cBot.r}, ${cBot.g}, ${cBot.b})`);

            // --- NEON SETTINGS ---
            if (config.neon) {
                // Neon intensifies with volume and height
                const neonIntensity = 5 + (avgNormalizedVolume * 15);
                ctx.shadowBlur = neonIntensity;
                // Shadow color based on bottom color for better bloom effect
                ctx.shadowColor = `rgba(${cBot.r}, ${cBot.g}, ${cBot.b}, 0.7)`; 
            } else {
                ctx.shadowBlur = 0;
            }

            const bW = (canvas.width / n);
            for (let i = 0; i < n; i++) {
                const pos = (i / (n - 1)) * 11, iL = Math.floor(pos), iR = Math.min(11, iL + 1), p = pos - iL;
                const curve = (1 - Math.cos(p * Math.PI)) / 2;
                let tH = isPlaying ? ((tPitches[iL] * (1 - curve)) + (tPitches[iR] * curve)) * mH + 5 : 5;
                vels[i] = (vels[i] + (tH - heights[i]) * config.tension) * config.friction;
                heights[i] += vels[i];
                
                const finalH = Math.max(5, heights[i]);
                const y = canvas.height - finalH;
                const x = i * bW;

                ctx.fillStyle = grad;
                // Draw bar. shadowBlur applied automatically here if enabled
                ctx.fillRect(x, y, bW - 3, finalH); 
            }
            // Reset shadowBlur so it doesn't affect other drawings (like settings panel if rendered on canvas)
            ctx.shadowBlur = 0; 
            
            animationId = requestAnimationFrame(renderLoop);
        };
        animationId = requestAnimationFrame(renderLoop);
        return () => { 
            cancelAnimationFrame(animationId); 
            Spicetify.Player.removeEventListener("songchange", onSongChange); 
        };
    }, [config]);

    // --- RENDER SETTINGS UI ---
    return React.createElement('div', { style: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, overflow: 'hidden' } },
        React.createElement('canvas', { ref: canvasRef, style: { display: 'block' } }),
        React.createElement('div', {
            className: 'viz-settings-panel',
            style: {
                position: 'absolute', top: '20px', right: '20px', padding: '15px', background: 'rgba(0,0,0,0.9)', borderRadius: '10px', color: 'white',
                display: 'flex', flexDirection: 'column', gap: '8px', opacity: '0.0', transition: 'opacity 0.3s', zIndex: 1000,
                width: '220px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'auto'
            },
            onMouseEnter: (e) => e.currentTarget.style.opacity = '1',
            onMouseLeave: (e) => e.currentTarget.style.opacity = '0.0'
        },
            React.createElement('span', { style: { fontWeight: 'bold', fontSize: '14px', marginBottom: '5px', textAlign: 'center', color: '#1db954' } }, "VISUALIZER SETTINGS"),
            
            // --- COLOR SECTION ---
            React.createElement('div', { style: { borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '5px' } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' } },
                    React.createElement('label', { style: { fontSize: '11px', fontWeight: 'bold' } }, "Neon Effect"),
                    React.createElement('input', { type: 'checkbox', checked: config.neon, onChange: (e) => setConfig({...config, neon: e.target.checked}) })
                ),
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' } },
                    React.createElement('label', { style: { fontSize: '11px', fontWeight: 'bold' } }, "Manual Color Mode"),
                    React.createElement('input', { type: 'checkbox', checked: config.manual, onChange: (e) => setConfig({...config, manual: e.target.checked}) })
                ),
                config.manual && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                        React.createElement('label', { style: { fontSize: '11px' } }, "Color (Bottom)"),
                        React.createElement('input', { type: 'color', value: config.hexBot, style: { width: '40px', height: '20px', border: 'none', padding: '0', background: 'none', cursor: 'pointer' }, onChange: (e) => setConfig({...config, hexBot: e.target.value}) })
                    ),
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                        React.createElement('label', { style: { fontSize: '11px' } }, "Color (Top)"),
                        React.createElement('input', { type: 'color', value: config.hexTop, style: { width: '40px', height: '20px', border: 'none', padding: '0', background: 'none', cursor: 'pointer' }, onChange: (e) => setConfig({...config, hexTop: e.target.value}) })
                    )
                )
            ),

            // --- SLIDERS SECTION ---
            ["Friction", "Tension", "Delay", "Sensitivity", "Bars", "Brightness Boost"].map((label, idx) => {
                const keys = ["friction", "tension", "delay", "sensitivity", "bars", "brightness"];
                const key = keys[idx];
                const value = config[key] || 0;
                
                let min = 0.5, max = 0.95, step = 0.01;
                if (key === "tension") { min = 0.02; max = 0.3; }
                else if (key === "delay") { min = -300; max = 300; step = 1; }
                else if (key === "sensitivity") { min = 0.5; max = 2.5; }
                else if (key === "bars") { min = 20; max = 150; step = 1; }
                else if (key === "brightness") { min = 0; max = 255; step = 5; }

                return React.createElement(React.Fragment, { key },
                    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' } },
                        React.createElement('label', null, label),
                        React.createElement('span', { style: { color: '#b3b3b3' } }, key === "delay" ? `${value}ms` : (key === "bars" || key === "brightness" ? value : value.toFixed(2)))
                    ),
                    React.createElement('input', { 
                        type: 'range', min, max, step, value, 
                        style: { width: '100%', cursor: 'pointer', accentColor: '#1db954' },
                        onChange: (e) => setConfig({...config, [key]: parseFloat(e.target.value)}) 
                    })
                );
            })
        )
    );
}

let render = () => React.createElement(VisualizadorProConfig);