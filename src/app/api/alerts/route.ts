import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const alertsPath = path.join(process.cwd(), 'alerts.txt');
    if (fs.existsSync(alertsPath)) {
      const content = fs.readFileSync(alertsPath, 'utf8').trim();
      return NextResponse.json({ alert: content, hasAlert: content.length > 0 });
    }
    return NextResponse.json({ alert: '', hasAlert: false });
  } catch (error) {
    return NextResponse.json({ alert: '', hasAlert: false });
  }
}
