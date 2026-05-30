@echo off
cd /d "C:\Users\AlvineOtieno\OneDrive - Pamela Steele Associates\Alvine Otieno\Hire\Dash"
"C:\Program Files\nodejs\npm.cmd" run dev -- --host 0.0.0.0 --port 8080 > scratch\vite-8080.out.log 2> scratch\vite-8080.err.log
