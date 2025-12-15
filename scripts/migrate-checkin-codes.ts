/**
 * Migration Script: Add Check-In Codes to Existing Invitations
 * 
 * This script adds unique 6-digit check-in codes to all invitations
 * that don't have one yet (created before the check-in code feature).
 * 
 * Usage:
 *   npx ts-node scripts/migrate-checkin-codes.ts
 */

import { AppDataSource } from '../src/config/database';
import { Invitation } from '../src/entities/Invitation';
import crypto from 'crypto';

async function generateCheckInCode(): Promise<string> {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function migrateCheckInCodes() {
    try {
        // Initialize database connection
        await AppDataSource.initialize();
        console.log('✓ Database connected');

        const invitationRepository = AppDataSource.getRepository(Invitation);

        // Find all invitations without check-in codes
        const invitationsWithoutCodes = await invitationRepository.find({
            where: { checkInCode: null as any },
        });

        console.log(`Found ${invitationsWithoutCodes.length} invitations without check-in codes`);

        if (invitationsWithoutCodes.length === 0) {
            console.log('✓ All invitations already have check-in codes');
            await AppDataSource.destroy();
            return;
        }

        let updated = 0;
        let failed = 0;

        for (const invitation of invitationsWithoutCodes) {
            let attempts = 0;
            let codeGenerated = false;

            // Try up to 10 times to generate a unique code
            while (!codeGenerated && attempts < 10) {
                attempts++;
                const checkInCode = await generateCheckInCode();

                // Check if code already exists
                const existing = await invitationRepository.findOne({
                    where: { checkInCode },
                });

                if (!existing) {
                    // Code is unique, save it
                    invitation.checkInCode = checkInCode;
                    await invitationRepository.save(invitation);
                    updated++;
                    codeGenerated = true;
                    console.log(`  ✓ Added code ${checkInCode} to invitation ${invitation.id}`);
                }
            }

            if (!codeGenerated) {
                failed++;
                console.error(`  ✗ Failed to generate unique code for invitation ${invitation.id} after 10 attempts`);
            }
        }

        console.log('\n=== Migration Complete ===');
        console.log(`✓ Updated: ${updated} invitations`);
        if (failed > 0) {
            console.log(`✗ Failed: ${failed} invitations`);
        }

        await AppDataSource.destroy();
        console.log('✓ Database connection closed');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateCheckInCodes()
    .then(() => {
        console.log('Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration error:', error);
        process.exit(1);
    });
