const googleServicesPlist = process.env.GOOGLE_SERVICES_PLIST_BASE64
  ? Buffer.from(process.env.GOOGLE_SERVICES_PLIST_BASE64, 'base64').toString('utf-8')
  : process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist';
