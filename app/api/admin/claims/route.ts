import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const claimsSnapshot = await getDocs(collection(db, 'claims'));
    const claims = claimsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      data: claims
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch claims'
    }, { status: 500 });
  }
}







