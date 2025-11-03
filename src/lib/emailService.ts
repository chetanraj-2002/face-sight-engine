import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;

export const sendCredentialsEmail = async (
  toEmail: string,
  toName: string,
  password: string,
  role: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!SERVICE_ID || !PUBLIC_KEY || !TEMPLATE_ID) {
      console.error('EmailJS configuration missing');
      return { 
        success: false, 
        error: 'Email service not configured. Please contact administrator.' 
      };
    }

    const templateParams = {
      to_email: toEmail,
      to_name: toName,
      user_email: toEmail,
      user_password: password,
      role: role.toUpperCase().replace('_', ' '),
    };

    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { 
      success: false, 
      error: error?.text || 'Failed to send email' 
    };
  }
};
