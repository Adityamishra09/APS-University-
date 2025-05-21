// Configuration
const CONFIG = {
  // Replace these with your actual Google Sheet IDs
  SHEET_IDS: [
    '1ctOZOZjkfG1OXdYXuQMYR-O09hnCHvV-_KTVuT7guMo',  // Main sheet
    // 'YOUR_SECOND_SHEET_ID',  // Uncomment and add your second sheet ID when needed
    // 'YOUR_THIRD_SHEET_ID'    // Uncomment and add your third sheet ID when needed
  ],
  SHEET_NAMES: [
    'Alumni Data 1',
    // 'Alumni Data 2',  // Uncomment when adding second sheet
    // 'Alumni Data 3'   // Uncomment when adding third sheet
  ],
  MAX_ROWS_PER_SHEET: 1000, // Maximum rows per sheet before switching
  COLUMN_NAMES: [
    'Timestamp',
    'Name',
    'Email',
    'Phone',
    'Department',
    'Batch',
    'Organization',
    'Address',
    'Message',
    'Photo URL'
  ]
};

// Handle POST requests from the form
function doPost(e) {
  try {
    // Log the incoming request
    console.log('Received POST request');
    console.log('Request parameters:', e.parameters);
    console.log('Post data:', e.postData.contents);
    
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    console.log('Parsed data:', data);
    
    // Validate required fields
    if (!validateData(data)) {
      console.error('Validation failed: Missing required fields');
      return createErrorResponse('Missing required fields');
    }

    // Find the next available sheet
    console.log('Finding next available sheet...');
    const sheetInfo = findNextAvailableSheet();
    if (!sheetInfo) {
      console.error('No available sheets found');
      return createErrorResponse('All sheets are full. Please contact administrator.');
    }
    console.log('Found available sheet:', sheetInfo.sheet.getName());

    // Prepare row data
    const rowData = prepareRowData(data);
    console.log('Prepared row data:', rowData);

    // Append data to the sheet
    const sheet = sheetInfo.sheet;
    sheet.appendRow(rowData);
    console.log('Data appended to sheet');

    // Handle photo upload if present
    let photoUrl = '';
    if (data.photo) {
      console.log('Processing photo upload...');
      photoUrl = uploadPhoto(data.photo, data.photoName, data.name);
      console.log('Photo uploaded, URL:', photoUrl);
      
      // Update the photo URL in the last row
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, CONFIG.COLUMN_NAMES.indexOf('Photo URL') + 1).setValue(photoUrl);
      console.log('Photo URL updated in sheet');
    }

    // Send confirmation email
    console.log('Sending confirmation email...');
    sendConfirmationEmail(data.email, data.name);
    console.log('Confirmation email sent');

    return createSuccessResponse('Data submitted successfully');
  } catch (error) {
    console.error('Error in doPost:', error);
    console.error('Error stack:', error.stack);
    return createErrorResponse(error.message || 'An error occurred while processing your request');
  }
}

// Add this function to test the script
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: 'Script is running correctly',
    config: {
      sheetCount: CONFIG.SHEET_IDS.length,
      maxRows: CONFIG.MAX_ROWS_PER_SHEET,
      columns: CONFIG.COLUMN_NAMES
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

// Find the next available sheet
function findNextAvailableSheet() {
  for (let i = 0; i < CONFIG.SHEET_IDS.length; i++) {
    const sheetId = CONFIG.SHEET_IDS[i];
    const sheetName = CONFIG.SHEET_NAMES[i];
    
    try {
      const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
      if (!sheet) {
        // Create sheet if it doesn't exist
        const spreadsheet = SpreadsheetApp.openById(sheetId);
        const newSheet = spreadsheet.insertSheet(sheetName);
        setupSheet(newSheet);
        return { sheet: newSheet, index: i };
      }

      const lastRow = sheet.getLastRow();
      if (lastRow < CONFIG.MAX_ROWS_PER_SHEET) {
        return { sheet: sheet, index: i };
      }
    } catch (error) {
      console.error(`Error accessing sheet ${sheetName}:`, error);
      continue;
    }
  }
  return null; // All sheets are full
}

// Setup new sheet with headers and formatting
function setupSheet(sheet) {
  // Add headers
  sheet.appendRow(CONFIG.COLUMN_NAMES);
  
  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, CONFIG.COLUMN_NAMES.length);
  headerRange.setBackground('#4285f4')
             .setFontColor('white')
             .setFontWeight('bold');
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Set column widths
  sheet.setColumnWidths(1, CONFIG.COLUMN_NAMES.length, 200);
}

// Validate incoming data
function validateData(data) {
  const requiredFields = ['name', 'email', 'phone', 'department', 'batch'];
  return requiredFields.every(field => data[field] && data[field].trim() !== '');
}

// Prepare row data for sheet
function prepareRowData(data) {
  return [
    new Date().toISOString(), // Timestamp
    data.name,
    data.email,
    data.phone,
    data.department,
    data.batch,
    data.organization || '',
    data.address || '',
    data.message || '',
    '' // Photo URL will be updated after upload
  ];
}

// Upload photo to Google Drive
function uploadPhoto(base64Data, fileName, userName) {
  try {
    // Create a folder for alumni photos if it doesn't exist
    const folderName = 'Alumni Photos';
    let folder = DriveApp.getFoldersByName(folderName).next();
    if (!folder) {
      folder = DriveApp.createFolder(folderName);
    }

    // Convert base64 to blob
    const base64Content = base64Data.split(',')[1];
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Content),
      'image/jpeg',
      `${userName}_${fileName}`
    );

    // Upload file to Drive
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (error) {
    console.error('Error uploading photo:', error);
    return '';
  }
}

// Send confirmation email
function sendConfirmationEmail(email, name) {
  const subject = 'APS Rewa University - Alumni Registration Confirmation';
  const body = `
    Dear ${name},

    Thank you for registering as an alumnus of APS Rewa University. Your registration has been received successfully.

    We will review your information and get back to you soon.

    Best regards,
    APS Rewa University Team
  `;

  try {
    MailApp.sendEmail(email, subject, body);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}

// Create success response
function createSuccessResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: message
  })).setMimeType(ContentService.MimeType.JSON);
}

// Create error response
function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: message
  })).setMimeType(ContentService.MimeType.JSON);
}

// Add menu to Google Sheets for setup
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Alumni Form')
    .addItem('Setup Sheets', 'setupAllSheets')
    .addToUi();
}

// Setup all sheets
function setupAllSheets() {
  CONFIG.SHEET_IDS.forEach((sheetId, index) => {
    try {
      const spreadsheet = SpreadsheetApp.openById(sheetId);
      let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAMES[index]);
      
      if (!sheet) {
        sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAMES[index]);
      }
      
      setupSheet(sheet);
    } catch (error) {
      console.error(`Error setting up sheet ${CONFIG.SHEET_NAMES[index]}:`, error);
    }
  });
} 