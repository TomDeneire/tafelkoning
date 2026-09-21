(function () {
    "use strict";

    const ROUND_SECONDS = 60;
    const COMBO_EVERY = 5;
    const BADGES = [
        { at: 5, icon: "🥉", name: "Bronzen Beginner" },
        { at: 10, icon: "🥈", name: "Zilveren Sprinter" },
        { at: 15, icon: "🥇", name: "Gouden Rekenaar" },
        { at: 20, icon: "💎", name: "Diamanten Denker" },
        { at: 25, icon: "🚀", name: "Raket-Brein" },
        { at: 30, icon: "👑", name: "Tafelkoning" },
    ];
    const STORAGE_KEY = "tafels-v1";

    const $ = (id) => document.getElementById(id);

    const state = {
        mode: "mul",
        numbers: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
        score: 0,
        streak: 0,
        input: "",
        question: null,
        endsAt: 0,
        timerId: 0,
        running: false,
        muted: false,
        saved: { badges: {}, best: {} },
    };

    // ---------- Persistence ----------

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) Object.assign(state.saved, JSON.parse(raw));
        } catch (e) {
            /* storage unavailable */
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
        } catch (e) {
            /* storage unavailable */
        }
    }

    // ---------- Screens ----------

    function show(name) {
        document
            .querySelectorAll(".screen")
            .forEach((s) => s.classList.remove("active"));
        $("screen-" + name).classList.add("active");
    }

    // ---------- Start screen ----------

    function buildFilter() {
        const box = $("filter");
        for (let n = 1; n <= 9; n++) {
            const b = document.createElement("button");
            b.textContent = n;
            b.className = "on";
            b.addEventListener("click", () => {
                if (state.numbers.has(n)) state.numbers.delete(n);
                else state.numbers.add(n);
                b.classList.toggle("on", state.numbers.has(n));
                $("start").disabled = state.numbers.size === 0;
            });
            box.appendChild(b);
        }
    }

    function renderBadges() {
        $("badges").innerHTML = BADGES.map((b) => {
            const got = state.saved.badges[b.at];
            return `<div class="badge${got ? " got" : ""}"><span class="ico">${b.icon}</span>${b.name}<br>(${b.at})</div>`;
        }).join("");
        const best = state.saved.best[state.mode];
        $("best").textContent = best
            ? `Beste score (${modeLabel(state.mode)}): ${best}`
            : "";
    }

    function modeLabel(mode) {
        return { mul: "vermenigvuldigen", div: "delen", mix: "mix" }[mode];
    }

    // ---------- Questions ----------

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function newQuestion() {
        const nums = [...state.numbers];
        let q;
        do {
            const a = pick(nums);
            const b = pick(nums);
            const op = state.mode === "mix" ? pick(["mul", "div"]) : state.mode;
            q =
                op === "mul"
                    ? { text: `${a} × ${b}`, answer: a * b }
                    : { text: `${a * b} : ${a}`, answer: b };
        } while (
            state.question &&
            q.text === state.question.text &&
            (nums.length > 1 || state.mode === "mix")
        );
        state.question = q;
        state.input = "";
        $("question").textContent = q.text;
        retrigger($("question"), "pop");
        renderAnswer();
        renderNextBadge();
    }

    function retrigger(el, cls) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
    }

    function renderAnswer(cls) {
        const el = $("answer");
        el.textContent = state.input || " ";
        el.classList.remove("good", "bad");
        if (cls) {
            void el.offsetWidth;
            el.classList.add(cls);
        }
    }

    function renderNextBadge() {
        const next = BADGES.find((b) => b.at > state.score);
        $("next-badge").textContent = next
            ? `Volgende: ${next.icon} bij ${next.at} juiste`
            : "🌟 Alle badges gehaald!";
    }

    // ---------- Game flow ----------

    function startRound() {
        state.score = 0;
        state.streak = 0;
        state.running = true;
        state.question = null;
        $("score").textContent = "0";
        $("streak").textContent = "0";
        setMascot("😀");
        show("game");
        newQuestion();
        state.endsAt = performance.now() + ROUND_SECONDS * 1000;
        clearInterval(state.timerId);
        state.timerId = setInterval(tick, 100);
        tick();
    }

    function tick() {
        const left = Math.max(0, state.endsAt - performance.now());
        const frac = left / (ROUND_SECONDS * 1000);
        const fill = $("time-fill");
        fill.style.width = frac * 100 + "%";
        fill.style.background =
            frac > 0.5
                ? "var(--good)"
                : frac > 0.2
                  ? "var(--accent)"
                  : "var(--bad)";
        const secs = Math.ceil(left / 1000);
        $("time").textContent = secs;
        $("time").classList.toggle("low", secs <= 10);
        if (left <= 0) endRound();
    }

    function endRound() {
        clearInterval(state.timerId);
        state.running = false;
        const prevBest = state.saved.best[state.mode] || 0;
        const record = state.score > prevBest;
        if (record) state.saved.best[state.mode] = state.score;
        save();

        $("final-score").textContent = state.score;
        $("final-record").textContent =
            record && state.score > 0
                ? "🎉 Nieuw persoonlijk record!"
                : `Beste score: ${state.saved.best[state.mode] || 0}`;
        const got = BADGES.filter((b) => b.at <= state.score).pop();
        $("final-badge").innerHTML = got
            ? `<span class="ico">${got.icon}</span>${got.name}`
            : "Probeer 5 juiste antwoorden te halen voor je eerste badge!";
        show("end");
        if (state.score > 0) burst(innerWidth / 2, innerHeight / 3, 60);
        playTone([440, 330, 262], 0.15);
    }

    // ---------- Input ----------

    function press(key) {
        if (!state.running) return;
        if (key === "back") {
            state.input = state.input.slice(0, -1);
            renderAnswer();
            return;
        }
        if (key === "ok") {
            if (state.input) submit();
            return;
        }
        if (state.input.length >= 3) return;
        state.input += key;
        renderAnswer();
        playTone([600], 0.03);
        if (state.input.length === String(state.question.answer).length)
            submit();
    }

    function submit() {
        if (Number(state.input) === state.question.answer) correct();
        else wrong();
    }

    function correct() {
        state.score++;
        state.streak++;
        $("score").textContent = state.score;
        $("streak").textContent = state.streak;
        renderAnswer("good");
        setMascot("😀");
        playTone([660, 880], 0.07);

        const badge = BADGES.find((b) => b.at === state.score);
        if (badge) awardBadge(badge);
        else if (state.streak % COMBO_EVERY === 0) combo();

        setTimeout(() => {
            if (state.running) newQuestion();
        }, 150);
    }

    function wrong() {
        state.streak = 0;
        $("streak").textContent = "0";
        state.input = "";
        renderAnswer("bad");
        $("answer").textContent = "✖";
        setTimeout(() => {
            if (state.running) renderAnswer();
        }, 400);
        setMascot("😵");
        playTone([200, 150], 0.12);
    }

    function setMascot(emoji) {
        const m = $("mascot");
        m.textContent = emoji;
        retrigger(m, "bounce");
    }

    // ---------- Celebrations ----------

    function combo() {
        toast(`🔥 Combo x${state.streak}!`);
        burst(innerWidth / 2, innerHeight * 0.35, 40);
        playTone([523, 659, 784], 0.08);
    }

    function toast(text) {
        const t = document.createElement("div");
        t.className = "toast";
        t.textContent = text;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 1000);
    }

    function awardBadge(badge) {
        state.saved.badges[badge.at] = true;
        save();
        setMascot("😎");

        const c = $("celebrate");
        c.querySelector(".celebrate-badge").textContent = badge.icon;
        c.querySelector(".celebrate-name").textContent =
            `${badge.name}! (${badge.at} juiste)`;
        c.classList.remove("show");
        void c.offsetWidth;
        c.classList.add("show");

        document.body.classList.remove("shake");
        void document.body.offsetWidth;
        document.body.classList.add("shake");

        // Bigger badges get more explosions
        const level = BADGES.indexOf(badge) + 1;
        for (let i = 0; i < 2 + level; i++) {
            setTimeout(() => {
                burst(
                    innerWidth * (0.15 + Math.random() * 0.7),
                    innerHeight * (0.15 + Math.random() * 0.5),
                    70,
                );
            }, i * 220);
        }
        playTone([523, 659, 784, 1047], 0.12);
    }

    // ---------- Particles ----------

    const canvas = $("fx");
    const ctx = canvas.getContext("2d");
    let particles = [];
    let animating = false;

    function resize() {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
    }

    function burst(x, y, count) {
        const hue = Math.random() * 360;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 9;
            particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.008 + Math.random() * 0.012,
                size: 3 + Math.random() * 5,
                color: `hsl(${(hue + Math.random() * 90) % 360} 100% 60%)`,
                star: Math.random() < 0.2,
            });
        }
        if (!animating) {
            animating = true;
            requestAnimationFrame(frame);
        }
    }

    function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter((p) => p.life > 0);
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98;
            p.vy = p.vy * 0.98 + 0.15;
            p.life -= p.decay;
            ctx.globalAlpha = Math.max(p.life, 0);
            ctx.fillStyle = p.color;
            if (p.star) {
                ctx.font = `${p.size * 3}px sans-serif`;
                ctx.fillText("✨", p.x, p.y);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        if (particles.length) requestAnimationFrame(frame);
        else {
            animating = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // ---------- Sound ----------

    let audio = null;

    function playTone(freqs, step) {
        if (state.muted) return;
        try {
            audio =
                audio ||
                new (window.AudioContext || window.webkitAudioContext)();
            freqs.forEach((f, i) => {
                const o = audio.createOscillator();
                const g = audio.createGain();
                const t = audio.currentTime + i * step;
                o.type = "triangle";
                o.frequency.value = f;
                g.gain.setValueAtTime(0.15, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + step * 1.8);
                o.connect(g).connect(audio.destination);
                o.start(t);
                o.stop(t + step * 2);
            });
        } catch (e) {
            /* audio unavailable */
        }
    }

    // ---------- Wiring ----------

    function init() {
        load();
        resize();
        addEventListener("resize", resize);
        buildFilter();
        renderBadges();

        $("modes").addEventListener("click", (e) => {
            const btn = e.target.closest(".mode");
            if (!btn) return;
            state.mode = btn.dataset.mode;
            document
                .querySelectorAll(".mode")
                .forEach((m) => m.classList.toggle("active", m === btn));
            renderBadges();
        });

        $("start").addEventListener("click", startRound);
        $("again").addEventListener("click", startRound);
        $("menu").addEventListener("click", () => {
            renderBadges();
            show("start");
        });

        $("numpad").addEventListener("click", (e) => {
            const btn = e.target.closest("button");
            if (btn) press(btn.dataset.key);
        });

        $("mute").addEventListener("click", () => {
            state.muted = !state.muted;
            $("mute").textContent = state.muted ? "🔇" : "🔊";
        });
    }

    init();
})();
