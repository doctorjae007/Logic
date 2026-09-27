# คิดเป็น: ห้องเรียนตรรกศาสตร์

เว็บเรียนรู้ตรรกศาสตร์เบื้องต้นสำหรับนักเรียน มีบทเรียนเรื่องประพจน์ ตารางค่าความจริง และแบบฝึกหัดแบบเลือกคำตอบหรือเติมผลลัพธ์ในตาราง

## เริ่มต้นใช้งาน

ต้องติดตั้ง Node.js ก่อน จากนั้นรันคำสั่ง:

```sh
npm install
npm run dev
```

## คำสั่งที่ใช้ได้

- `npm run dev` เปิดเว็บสำหรับพัฒนา
- `npm run build` สร้างไฟล์ production ใน `dist/`
- `npm run preview` ดูตัวอย่าง production build
- `npm run lint` ตรวจโค้ดด้วย ESLint

## อันดับคะแนนออนไลน์

โหมดไม่ตั้งค่า backend จะเก็บคะแนนไว้ใน browser เครื่องนี้เท่านั้น หากต้องการให้นักเรียนคนอื่นเห็นอันดับร่วมกัน ให้เชื่อม Supabase:

1. สร้าง Supabase project และเปิด Anonymous Sign-ins ใน Authentication settings
2. รัน SQL ใน `supabase/scoreboard.sql` ผ่าน Supabase SQL Editor
3. เพิ่ม `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน GitHub repository variables ที่ Settings > Secrets and variables > Actions > Variables
4. รัน workflow `Deploy to GitHub Pages` อีกครั้ง

สำหรับพัฒนาในเครื่อง ตั้งค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน `.env.local` โดยใช้ `.env.example` เป็นรายการตัวแปร

ชื่อเล่นและอีโมจิที่เลือกจะแสดงต่อสาธารณะใน leaderboard พร้อมคะแนน ระดับโจทย์ และเวลาที่ใช้ ห้ามใส่ชื่อจริงหรือข้อมูลส่วนตัว

## เนื้อหา

- ประพจน์และค่าความจริง
- ตัวเชื่อม `¬`, `∧`, `∨`, `→` และ `↔`
- ตารางค่าความจริงแบบโต้ตอบ
- แบบฝึกหัดพร้อมตรวจคำตอบและคำอธิบาย

ใช้ `T` แทนค่าจริง และ `F` แทนค่าเท็จตามสัญกรณ์ในหนังสือเรียน
