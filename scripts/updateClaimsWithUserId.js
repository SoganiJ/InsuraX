// Script to update existing claims with userId and email fields
// Run this script to fix existing claims that don't have userId

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateClaimsWithUserId() {
  try {
    console.log('Starting to update claims with userId and email...');
    
    // Get all claims
    const claimsSnapshot = await getDocs(collection(db, 'claims'));
    console.log(`Found ${claimsSnapshot.docs.length} claims to process`);
    
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = {};
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      users[doc.id] = userData;
    });
    console.log(`Found ${Object.keys(users).length} users`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const claimDoc of claimsSnapshot.docs) {
      const claimData = claimDoc.data();
      const claimId = claimDoc.id;
      
      // Skip if already has userId
      if (claimData.userId) {
        console.log(`Skipping claim ${claimData.claimId || claimId} - already has userId`);
        skippedCount++;
        continue;
      }
      
      // Try to find matching user by claimantName
      let matchingUser = null;
      if (claimData.claimantName) {
        matchingUser = Object.values(users).find(user => 
          user.displayName === claimData.claimantName
        );
      }
      
      if (matchingUser) {
        // Update the claim with userId and email
        await updateDoc(doc(db, 'claims', claimId), {
          userId: matchingUser.uid,
          email: matchingUser.email
        });
        
        console.log(`Updated claim ${claimData.claimId || claimId} with userId: ${matchingUser.uid}`);
        updatedCount++;
      } else {
        console.log(`No matching user found for claim ${claimData.claimId || claimId} with claimantName: ${claimData.claimantName}`);
        skippedCount++;
      }
    }
    
    console.log(`\nUpdate complete!`);
    console.log(`Updated: ${updatedCount} claims`);
    console.log(`Skipped: ${skippedCount} claims`);
    
  } catch (error) {
    console.error('Error updating claims:', error);
  }
}

// Run the update
updateClaimsWithUserId();
