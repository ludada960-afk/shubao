import { v4 as uuidv4 } from 'uuid';
import { db } from './db';

/**
 * Generate a new invitation code
 * @param {string} userId - The user ID who is generating the invitation
 * @param {number} maxUses - Maximum number of times this invitation can be used (default: 1)
 * @param {string} expiresAt - Expiration date (default: 30 days from now)
 * @returns {Promise<Object>} - Invitation code data
 */
export async function generateInvitationCode(userId, maxUses = 1, expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()) {
  const code = uuidv4().substring(0, 8).toUpperCase(); // 8-character code
  
  const invitation = {
    id: uuidv4(),
    code,
    userId,
    maxUses,
    used: 0,
    expiresAt,
    createdAt: new Date().toISOString(),
    status: 'active',
  };
  
  await db.collection('invitations').insertOne(invitation);
  
  return {
    code,
    invitationId: invitation.id,
    expiresAt,
    maxUses,
    used: 0,
  };
}

/**
 * Redemption invitation code
 * @param {string} code - The invitation code to redeem
 * @returns {Promise<Object>} - Redemption result
 */
export async function redeemInvitationCode(code) {
  const invitation = await db.collection('invitations').findOne({ code, status: 'active' });
  
  if (!invitation) {
    throw new Error('Invitation code not found or expired');
  }
  
  if (invitation.used >= invitation.maxUses) {
    throw new Error('Invitation code has reached maximum uses');
  }
  
  if (new Date() > new Date(invitation.expiresAt)) {
    throw new Error('Invitation code has expired');
  }
  
  // Update the invitation
  await db.collection('invitations').updateOne(
    { _id: invitation.id },
    { 
      $inc: { used: 1 },
      $set: { used: { $add: ['$used', 1] } }
    }
  );
  
  return {
    success: true,
    invitationId: invitation.id,
    code: invitation.code,
    redeemedAt: new Date().toISOString(),
  };
}

/**
 * Get invitation details by code
 * @param {string} code - The invitation code to look up
 * @returns {Promise<Object>} - Invitation details
 */
export async function getInvitationByCode(code) {
  const invitation = await db.collection('invitations').findOne({ code, status: 'active' });
  
  if (!invitation) {
    return null;
  }
  
  return {
    code: invitation.code,
    userId: invitation.userId,
    maxUses: invitation.maxUses,
    used: invitation.used,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}