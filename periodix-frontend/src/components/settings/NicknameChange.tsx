import { useState, useCallback } from 'react';
import type { User } from '../../types';
import { updateMyProfile } from '../../api';

interface NicknameChangeProps {
    token: string;
    user: User;
    onUserUpdate?: (user: User) => void;
}

export default function NicknameChange({ token, user, onUserUpdate }: NicknameChangeProps) {
    const [myDisplayName, setMyDisplayName] = useState<string>(user.displayName ?? '');
    const [myTimezone, setMyTimezone] = useState<string>(user.timezone ?? 'Europe/Berlin');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileSaved, setProfileSaved] = useState(false);

    const handleSaveProfile = useCallback(async () => {
        setSavingProfile(true);
        setProfileError(null);
        setProfileSaved(false);
        try {
            const trimmedName = myDisplayName.trim();
            const displayNameToSave = trimmedName === '' ? null : trimmedName;
            
            const result = await updateMyProfile(token, { 
                displayName: displayNameToSave,
                timezone: myTimezone
            });

            // Update the user in the parent component
            if (onUserUpdate) {
                onUserUpdate({
                    ...user,
                    displayName: displayNameToSave,
                    timezone: myTimezone,
                });
            }
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 3000);
        } catch (e) {
            setProfileError(
                e instanceof Error ? e.message : 'Failed to update profile'
            );
        } finally {
            setSavingProfile(false);
        }
    }, [token, myDisplayName, myTimezone, user, onUserUpdate]);

    // Common timezones list
    const commonTimezones = [
        'Europe/Berlin',
        'Europe/Vienna', 
        'Europe/Zurich',
        'Europe/Paris',
        'Europe/London',
        'Europe/Rome',
        'Europe/Madrid',
        'Europe/Amsterdam',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney',
    ];

    const hasChanges = myDisplayName !== (user.displayName ?? '') || myTimezone !== (user.timezone ?? 'Europe/Berlin');

    return (
        <div>
            <h3 className="text-lg font-medium mb-4 text-slate-900 dark:text-slate-100">
                Profile Settings
            </h3>
            
            <div className="space-y-4">
                <div>
                    <label
                        htmlFor="displayName"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                    >
                        Display Name
                    </label>
                    <input
                        id="displayName"
                        className="input w-full"
                        placeholder="Your display name"
                        value={myDisplayName}
                        onChange={(e) => {
                            setMyDisplayName(e.target.value);
                            setProfileSaved(false);
                        }}
                        disabled={savingProfile}
                    />
                </div>
                
                <div>
                    <label
                        htmlFor="timezone"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                    >
                        Timezone for Notifications
                    </label>
                    <select
                        id="timezone"
                        className="input w-full"
                        value={myTimezone}
                        onChange={(e) => {
                            setMyTimezone(e.target.value);
                            setProfileSaved(false);
                        }}
                        disabled={savingProfile}
                    >
                        {commonTimezones.map(tz => (
                            <option key={tz} value={tz}>
                                {tz.replace('_', ' ')}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        This determines when you receive lesson notifications (e.g., "5 minutes before")
                    </p>
                </div>
                
                <div className="flex gap-2">
                    <button
                        className="btn-primary"
                        onClick={handleSaveProfile}
                        disabled={savingProfile || !hasChanges}
                    >
                        {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
                
                {profileError && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                        {profileError}
                    </div>
                )}
                {profileSaved && !profileError && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                        Profile updated! Notifications will now use your selected timezone.
                    </div>
                )}
            </div>
        </div>
    );
}