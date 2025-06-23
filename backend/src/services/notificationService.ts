import sgMail from '@sendgrid/mail';
import { query } from '../config/database';
import { NotificationQueue, TokenAlert } from '../types';
import { TelegramBotService } from './telegramBotService';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@solana-alerts.com';
const FROM_NAME = process.env.FROM_NAME || 'Solana Token Alerts';

// Initialize SendGrid
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

export class NotificationService {
    private telegramBotService: TelegramBotService;

    constructor() {
        this.telegramBotService = TelegramBotService.getInstance();
    }

    async sendAlertNotification(alert: TokenAlert, currentPrice: number): Promise<boolean> {
        try {
            // Check if the notification type is enabled
            const emailEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false';
            const telegramEnabled = process.env.ENABLE_TELEGRAM_NOTIFICATIONS !== 'false';

            if (alert.notification_type === 'email' && !emailEnabled) {
                console.log('Email notifications are disabled, skipping email alert');
                return false;
            }

            if (alert.notification_type === 'telegram' && !telegramEnabled) {
                console.log('Telegram notifications are disabled, skipping telegram alert');
                return false;
            }

            const message = this.generateAlertMessage(alert, currentPrice);
            const subject = this.generateAlertSubject(alert);

            // Add to notification queue
            const queueId = await this.addToQueue(alert, subject, message);

            if (alert.notification_type === 'email') {
                return await this.sendEmail(alert, subject, message, queueId);
            } else if (alert.notification_type === 'telegram') {
                return await this.sendTelegram(alert, message, queueId);
            }

            return false;
        } catch (error) {
            console.error('Error sending alert notification:', error);
            return false;
        }
    }

    private async addToQueue(
        alert: TokenAlert,
        subject: string,
        message: string
    ): Promise<string> {
        const recipient = alert.notification_type === 'email'
            ? await this.getUserEmail(alert.user_id)
            : await this.getUserTelegramChatId(alert.user_id);

        const result = await query(
            `INSERT INTO notification_queue (alert_id, type, recipient, subject, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [alert.id, alert.notification_type, recipient, subject, message]
        );

        return result.rows[0].id;
    }

    private async sendEmail(
        alert: TokenAlert,
        subject: string,
        message: string,
        queueId: string
    ): Promise<boolean> {
        try {
            if (!SENDGRID_API_KEY) {
                console.error('SendGrid API key not configured');
                await this.updateQueueStatus(queueId, 'failed');
                return false;
            }

            const userEmail = await this.getUserEmail(alert.user_id);
            if (!userEmail) {
                console.error('User email not found');
                await this.updateQueueStatus(queueId, 'failed');
                return false;
            }

            const emailData = {
                to: userEmail,
                from: {
                    email: FROM_EMAIL,
                    name: FROM_NAME,
                },
                subject,
                text: message,
                html: this.generateEmailHTML(alert, message),
            };

            await sgMail.send(emailData);
            await this.updateQueueStatus(queueId, 'sent');

            console.log(`Email sent successfully to ${userEmail}`);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            await this.updateQueueStatus(queueId, 'failed');
            return false;
        }
    }

    private async sendTelegram(
        alert: TokenAlert,
        message: string,
        queueId: string
    ): Promise<boolean> {
        try {
            const chatId = await this.getUserTelegramChatId(alert.user_id);
            if (!chatId) {
                console.error('User Telegram chat ID not found');
                await this.updateQueueStatus(queueId, 'failed');
                return false;
            }

            await this.telegramBotService.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            const success = true;

            if (success) {
                await this.updateQueueStatus(queueId, 'sent');
                console.log(`Telegram message sent successfully to ${chatId}`);
                return true;
            } else {
                await this.updateQueueStatus(queueId, 'failed');
                return false;
            }
        } catch (error) {
            console.error('Error sending Telegram message:', error);
            await this.updateQueueStatus(queueId, 'failed');
            return false;
        }
    }

    private async updateQueueStatus(queueId: string, status: 'sent' | 'failed'): Promise<void> {
        const sentAt = status === 'sent' ? 'CURRENT_TIMESTAMP' : null;
        await query(
            `UPDATE notification_queue 
       SET status = $1, sent_at = ${sentAt ? 'CURRENT_TIMESTAMP' : 'NULL'}, attempts = attempts + 1
       WHERE id = $2`,
            [status, queueId]
        );
    }

    private async getUserEmail(userId: string): Promise<string | null> {
        try {
            const result = await query(
                'SELECT email FROM users WHERE id = $1',
                [userId]
            );
            return result.rows[0]?.email || null;
        } catch (error) {
            console.error('Error fetching user email:', error);
            return null;
        }
    }

    private async getUserTelegramChatId(userId: string): Promise<string | null> {
        try {
            const result = await query(
                'SELECT telegram_chat_id FROM users WHERE id = $1',
                [userId]
            );
            return result.rows[0]?.telegram_chat_id || null;
        } catch (error) {
            console.error('Error fetching user Telegram chat ID:', error);
            return null;
        }

    }

    private generateAlertMessage(alert: TokenAlert, currentPrice: number): string {
        const condition = alert.condition === 'above' ? 'above' : 'below';
        const thresholdType = alert.threshold_type === 'price' ? 'price' : 'market cap';

        return `🚨 *Token Alert Triggered!*

*Token:* ${alert.token_name} (${alert.token_symbol})
*Address:* \`${alert.token_address}\`

*Alert:* ${thresholdType} ${condition} $${alert.threshold_value.toLocaleString()}
*Current ${thresholdType}:* $${currentPrice.toLocaleString()}

*Triggered at:* ${new Date().toLocaleString()}

This alert has been automatically disabled and won't trigger again unless you recreate it.`;
    }

    private generateAlertSubject(alert: TokenAlert): string {
        const condition = alert.condition === 'above' ? 'Above' : 'Below';
        const thresholdType = alert.threshold_type === 'price' ? 'Price' : 'Market Cap';

        return `🚨 ${alert.token_symbol} ${thresholdType} Alert: ${condition} $${alert.threshold_value.toLocaleString()}`;
    }

    private generateEmailHTML(alert: TokenAlert, message: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #ddd; }
        .alert-box { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
        .token-info { background: #f1f3f4; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .code { background: #f8f9fa; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Token Alert Triggered!</h1>
        </div>
        <div class="content">
            <div class="alert-box">
                <h3>Alert Details</h3>
                <div class="token-info">
                    <p><strong>Token:</strong> ${alert.token_name} (${alert.token_symbol})</p>
                    <p><strong>Address:</strong> <span class="code">${alert.token_address}</span></p>
                    <p><strong>Alert Condition:</strong> ${alert.threshold_type} ${alert.condition} $${alert.threshold_value.toLocaleString()}</p>
                    <p><strong>Triggered At:</strong> ${new Date().toLocaleString()}</p>
                </div>
            </div>
            
            <p>This alert has been automatically disabled and won't trigger again unless you recreate it.</p>
            
            <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="btn">
                    View Dashboard
                </a>
            </p>
        </div>
        <div class="footer">
            <p><small>Powered by Solana Token Alerts</small></p>
        </div>
    </div>
</body>
</html>`;
    }

    async processNotificationQueue(): Promise<void> {
        try {
            // Skip processing if both email and telegram are disabled
            const emailEnabled = process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false';
            const telegramEnabled = process.env.ENABLE_TELEGRAM_NOTIFICATIONS !== 'false';

            if (!emailEnabled && !telegramEnabled) {
                console.log('Both email and telegram notifications are disabled, skipping queue processing');
                return;
            }

            // Get pending notifications
            const result = await query(
                `SELECT * FROM notification_queue 
         WHERE status = 'pending' AND attempts < 3
         ORDER BY created_at ASC
         LIMIT 10`
            );

            const pendingNotifications = result.rows as NotificationQueue[];

            for (const notification of pendingNotifications) {
                try {
                    let success = false;

                    if (notification.type === 'email' && emailEnabled) {
                        success = await this.sendQueuedEmail(notification);
                    } else if (notification.type === 'telegram' && telegramEnabled) {
                        success = await this.sendQueuedTelegram(notification);
                    } else {
                        // Skip disabled notification types
                        console.log(`Skipping ${notification.type} notification (disabled)`);
                        continue;
                    }

                    if (success) {
                        await this.updateQueueStatus(notification.id, 'sent');
                    } else {
                        // Mark as failed if max attempts reached
                        if (notification.attempts >= 2) {
                            await this.updateQueueStatus(notification.id, 'failed');
                        }
                    }
                } catch (error) {
                    console.error(`Error processing notification ${notification.id}:`, error);
                    await this.updateQueueStatus(notification.id, 'failed');
                }
            }
        } catch (error) {
            console.error('Error processing notification queue:', error);
        }
    }

    private async sendQueuedEmail(notification: NotificationQueue): Promise<boolean> {
        try {
            if (!SENDGRID_API_KEY) return false;

            const emailData = {
                to: notification.recipient,
                from: {
                    email: FROM_EMAIL,
                    name: FROM_NAME,
                },
                subject: notification.subject,
                text: notification.message,
                html: notification.message.replace(/\n/g, '<br>'),
            };

            await sgMail.send(emailData);
            return true;
        } catch (error) {
            console.error('Error sending queued email:', error);
            return false;
        }
    }

    private async sendQueuedTelegram(notification: NotificationQueue): Promise<boolean> {
        try {
            await this.telegramBotService.sendMessage(notification.recipient, notification.message, { parse_mode: 'Markdown' });
            return true;
        } catch (error) {
            console.error('Error sending queued Telegram message:', error);
            return false;
        }
    }
} 