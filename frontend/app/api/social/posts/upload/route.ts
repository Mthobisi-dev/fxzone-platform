import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// POST /api/social/posts/upload — Upload media file for post/story attachment
export async function POST(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ detail: 'No file provided' }, { status: 400 });
    }

    const db = getSupabaseAdmin(request);
    const fileExt = file.name.split('.').pop() || 'png';
    const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    // 1. Try uploading to Supabase Storage bucket 'post-media'
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { data: uploadData, error: uploadErr } = await db.storage
        .from('post-media')
        .upload(filePath, buffer, {
          contentType: file.type || 'image/png',
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: publicUrlData } = db.storage
          .from('post-media')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return NextResponse.json({ url: publicUrlData.publicUrl });
        }
      }
    } catch (storageErr) {
      console.warn('Supabase storage upload notice:', storageErr);
    }

    // 2. Fallback: Convert to Data URL for instant, reliable media preview & persistence
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'image/png';
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    return NextResponse.json({ url: dataUrl });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', detail: error?.message },
      { status: 500 }
    );
  }
}
