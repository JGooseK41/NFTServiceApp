/**
 * Email Service using SendGrid
 * Handles all automated email notifications for TheBlockService
 */

const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@theblockaudit.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@theblockaudit.com';

if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    console.log('✅ SendGrid email service initialized');
} else {
    console.warn('⚠️ SENDGRID_API_KEY not set - email notifications disabled');
}

/**
 * Send an email using SendGrid
 */
async function sendEmail(to, subject, htmlContent, textContent = null) {
    if (!SENDGRID_API_KEY) {
        console.log('Email skipped (no API key):', { to, subject });
        return { success: false, reason: 'No API key configured' };
    }

    try {
        const msg = {
            to,
            from: {
                email: FROM_EMAIL,
                name: 'TheBlockService'
            },
            subject,
            html: htmlContent,
            text: textContent || htmlContent.replace(/<[^>]*>/g, '')
        };

        await sgMail.send(msg);
        console.log('Email sent successfully:', { to, subject });
        return { success: true };
    } catch (error) {
        console.error('Failed to send email:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Notify admin when a new server registers
 */
async function notifyNewServerRegistration(serverData) {
    const subject = `New Process Server Registration: ${serverData.agency_name}`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">TheBlockService</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">New Server Registration</p>
            </div>

            <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #333; margin-top: 0;">A new process server has registered</h2>

                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; color: #666; width: 140px;"><strong>Agency Name:</strong></td>
                            <td style="padding: 10px 0; color: #333;">${serverData.agency_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Wallet Address:</strong></td>
                            <td style="padding: 10px 0; color: #333; font-family: monospace; font-size: 12px;">${serverData.wallet_address}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Contact Email:</strong></td>
                            <td style="padding: 10px 0; color: #333;">${serverData.contact_email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Phone Number:</strong></td>
                            <td style="padding: 10px 0; color: #333;">${serverData.phone_number}</td>
                        </tr>
                        ${serverData.website ? `
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Website:</strong></td>
                            <td style="padding: 10px 0; color: #333;">${serverData.website}</td>
                        </tr>
                        ` : ''}
                        ${serverData.license_number ? `
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>License Number:</strong></td>
                            <td style="padding: 10px 0; color: #333;">${serverData.license_number}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Registered At:</strong></td>
                            <td style="padding: 10px 0; color: #333;">${new Date().toLocaleString()}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 25px; padding: 15px; background: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800;">
                    <p style="margin: 0; color: #e65100;">
                        <strong>Action Required:</strong> This server needs blockchain approval before they can mint NFTs.
                    </p>
                    <p style="margin: 10px 0 0 0; color: #666;">
                        Go to Admin Panel → Role Management → Grant Process Server Role
                    </p>
                </div>

                <div style="margin-top: 25px; text-align: center;">
                    <a href="https://theblockservice.com"
                       style="display: inline-block; padding: 12px 30px; background: #667eea; color: white;
                              text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Open Admin Panel
                    </a>
                </div>
            </div>

            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>TheBlockService - A Product of The Block Audit LLC</p>
            </div>
        </div>
    `;

    return sendEmail(ADMIN_EMAIL, subject, htmlContent);
}

/**
 * Send welcome email to newly registered server
 */
async function sendServerWelcomeEmail(serverData) {
    const subject = `Welcome to TheBlockService - Registration Received`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">TheBlockService</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Blockchain Legal Service Platform</p>
            </div>

            <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #333; margin-top: 0;">Welcome, ${serverData.agency_name}!</h2>

                <p style="color: #555; line-height: 1.6;">
                    Thank you for registering with TheBlockService. Your agency has been successfully registered
                    in our system.
                </p>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #667eea; margin-top: 0;">Registration Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>Agency:</strong></td>
                            <td style="padding: 8px 0; color: #333;">${serverData.agency_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>Wallet:</strong></td>
                            <td style="padding: 8px 0; color: #333; font-family: monospace; font-size: 11px;">${serverData.wallet_address}</td>
                        </tr>
                    </table>
                </div>

                <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1976d2; margin-top: 0;">What's Next?</h3>
                    <ol style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li><strong>Await Approval:</strong> An administrator will review and approve your registration on the blockchain.</li>
                        <li><strong>Confirmation:</strong> You'll receive another email once your account is approved.</li>
                        <li><strong>Start Serving:</strong> After approval, you can begin serving legal notices via blockchain.</li>
                    </ol>
                </div>

                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
                    <p style="margin: 0; color: #e65100;">
                        <strong>Note:</strong> Approval typically takes 1-2 business days. If you haven't heard from us
                        within that time, please contact support.
                    </p>
                </div>

                <p style="color: #555; line-height: 1.6; margin-top: 25px;">
                    If you have any questions, please don't hesitate to reach out to our support team.
                </p>
            </div>

            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>TheBlockService - A Product of The Block Audit LLC</p>
                <p>This is an automated message. Please do not reply directly to this email.</p>
            </div>
        </div>
    `;

    return sendEmail(serverData.contact_email, subject, htmlContent);
}

/**
 * Notify server when their account is approved on the blockchain
 */
async function notifyServerApproved(serverData) {
    const subject = `Your TheBlockService Account is Approved!`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">TheBlockService</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Account Approved!</p>
            </div>

            <div style="padding: 30px; background: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 25px;">
                    <div style="display: inline-block; width: 80px; height: 80px; background: #4caf50; border-radius: 50%;
                                line-height: 80px; font-size: 40px; color: white;">
                        ✓
                    </div>
                </div>

                <h2 style="color: #333; margin-top: 0; text-align: center;">Congratulations, ${serverData.agency_name}!</h2>

                <p style="color: #555; line-height: 1.6; text-align: center;">
                    Your account has been approved on the blockchain. You can now start serving legal notices
                    through TheBlockService platform.
                </p>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
                    <h3 style="color: #4caf50; margin-top: 0;">You're Ready to Go!</h3>
                    <p style="color: #555;">
                        Log in with your wallet to start serving blockchain-verified legal notices.
                    </p>
                    <a href="https://theblockservice.com"
                       style="display: inline-block; padding: 15px 40px; background: #4caf50; color: white;
                              text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">
                        Start Serving Notices
                    </a>
                </div>

                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px;">
                    <h4 style="color: #2e7d32; margin-top: 0;">Quick Start Guide:</h4>
                    <ol style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Connect your registered wallet</li>
                        <li>Navigate to "Serve Notice"</li>
                        <li>Upload your legal documents</li>
                        <li>Enter recipient wallet address(es)</li>
                        <li>Complete the blockchain transaction</li>
                    </ol>
                </div>
            </div>

            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>TheBlockService - A Product of The Block Audit LLC</p>
            </div>
        </div>
    `;

    return sendEmail(serverData.contact_email, subject, htmlContent);
}

/**
 * Notify server when a recipient accesses their notice
 */
async function notifyNoticeAccessed(serverEmail, accessData) {
    const { caseNumber, recipientAddress, actionType, timestamp, serverName } = accessData;

    // Determine action description
    const actionDescriptions = {
        'recipient_notice_query': 'checked their notices',
        'recipient_document_view': 'viewed the legal document',
        'recipient_document_download': 'downloaded the PDF',
        'wallet_connect': 'connected their wallet',
        'document_signed': 'signed the document',
        'view': 'viewed the notice',
        'view_document': 'viewed the document',
        'decrypt': 'decrypted the document'
    };

    const actionDesc = actionDescriptions[actionType] || actionType.replace(/_/g, ' ');
    const subject = `📋 Notice Accessed: ${caseNumber} - Recipient ${actionDesc}`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">TheBlockService</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Notice Access Alert</p>
            </div>

            <div style="padding: 30px; background: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; width: 60px; height: 60px; background: #4caf50; border-radius: 50%;
                                line-height: 60px; font-size: 30px; color: white;">
                        👁️
                    </div>
                </div>

                <h2 style="color: #333; margin-top: 0; text-align: center;">A recipient has accessed your notice!</h2>

                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; color: #666; width: 140px;"><strong>Case Number:</strong></td>
                            <td style="padding: 10px 0; color: #333; font-weight: bold;">${caseNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Recipient:</strong></td>
                            <td style="padding: 10px 0; color: #333; font-family: monospace; font-size: 12px;">${recipientAddress}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Action:</strong></td>
                            <td style="padding: 10px 0; color: #333;">
                                <span style="background: #e8f5e9; padding: 4px 12px; border-radius: 4px; color: #2e7d32;">
                                    ${actionDesc.charAt(0).toUpperCase() + actionDesc.slice(1)}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Time:</strong></td>
                            <td style="padding: 10px 0; color: #333;">${new Date(timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 25px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                    <p style="margin: 0; color: #1976d2;">
                        <strong>What this means:</strong> The recipient has interacted with the legal notice you served.
                        This activity is permanently logged on the blockchain for legal compliance.
                    </p>
                </div>

                <div style="margin-top: 25px; text-align: center;">
                    <a href="https://theblockservice.com"
                       style="display: inline-block; padding: 12px 30px; background: #667eea; color: white;
                              text-decoration: none; border-radius: 6px; font-weight: bold;">
                        View Full Audit Log
                    </a>
                </div>
            </div>

            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>TheBlockService - A Product of The Block Audit LLC</p>
                <p style="margin-top: 10px;">
                    <a href="https://theblockservice.com/settings" style="color: #999;">Manage notification preferences</a>
                </p>
            </div>
        </div>
    `;

    return sendEmail(serverEmail, subject, htmlContent);
}

/**
 * Notify server of first-time document view (more important than subsequent views)
 */
async function notifyFirstDocumentView(serverEmail, accessData) {
    const { caseNumber, recipientAddress, timestamp } = accessData;

    const subject = `✅ DOCUMENT VIEWED: Case ${caseNumber} - Legal Notice Confirmed Received`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">TheBlockService</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Document View Confirmation</p>
            </div>

            <div style="padding: 30px; background: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; width: 80px; height: 80px; background: #4caf50; border-radius: 50%;
                                line-height: 80px; font-size: 40px; color: white;">
                        ✓
                    </div>
                </div>

                <h2 style="color: #2e7d32; margin-top: 0; text-align: center;">Document Successfully Viewed!</h2>

                <p style="color: #555; line-height: 1.6; text-align: center; font-size: 16px;">
                    The recipient has <strong>opened and viewed</strong> the legal document for case <strong>${caseNumber}</strong>.
                    This provides strong evidence of actual notice.
                </p>

                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50; margin: 25px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px 0; color: #666; width: 140px;"><strong>Case Number:</strong></td>
                            <td style="padding: 10px 0; color: #333; font-weight: bold; font-size: 18px;">${caseNumber}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>Recipient:</strong></td>
                            <td style="padding: 10px 0; color: #333; font-family: monospace; font-size: 12px;">${recipientAddress}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #666;"><strong>First Viewed:</strong></td>
                            <td style="padding: 10px 0; color: #333;">${new Date(timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td>
                        </tr>
                    </table>
                </div>

                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px;">
                    <h4 style="color: #2e7d32; margin-top: 0;">📋 Legal Significance</h4>
                    <p style="color: #555; margin: 0; line-height: 1.6;">
                        This document view is permanently recorded on the blockchain and in our audit logs.
                        This evidence can be used to demonstrate that the recipient received and reviewed the legal notice.
                    </p>
                </div>

                <div style="margin-top: 25px; text-align: center;">
                    <a href="https://theblockservice.com"
                       style="display: inline-block; padding: 15px 40px; background: #4caf50; color: white;
                              text-decoration: none; border-radius: 6px; font-weight: bold;">
                        View Complete Audit Trail
                    </a>
                </div>
            </div>

            <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                <p>TheBlockService - A Product of The Block Audit LLC</p>
            </div>
        </div>
    `;

    return sendEmail(serverEmail, subject, htmlContent);
}

module.exports = {
    sendEmail,
    notifyNewServerRegistration,
    sendServerWelcomeEmail,
    notifyServerApproved,
    notifyNoticeAccessed,
    notifyFirstDocumentView,
    ADMIN_EMAIL
};
