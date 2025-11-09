import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const policiesSnapshot = await getDocs(collection(db, 'policies'));
    const policies = policiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      data: policies
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch policies'
    }, { status: 500 });
  }
}







