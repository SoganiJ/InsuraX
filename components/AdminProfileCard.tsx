// components/AdminProfileCard.tsx
import React from 'react';
import { User } from 'firebase/auth';

interface AdminProfileCardProps {
  user: User;
  userData: any;
}

const AdminProfileCard: React.FC<AdminProfileCardProps> = ({ user, userData }) => {
  return (
    <div className="bg-gradient-to-r from-blue-900/50 to-slate-800 p-6 rounded-xl border border-slate-700">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
          {user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{user.displayName || 'Admin'}</h2>
          <p className="text-slate-300">{user.email}</p>
          <div className="mt-1">
            <span className="inline-block bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">
              Administrator
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-slate-400 text-sm">Admin Since</p>
          <p className="text-white">
            {userData?.createdAt?.toDate().toLocaleDateString() || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-sm">Permissions</p>
          <p className="text-white">Full Access</p>
        </div>
      </div>
    </div>
  );
};

export default AdminProfileCard;