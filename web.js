function doGet(e) {
  const docId = e.parameter.docId;
  if (!docId) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'docId 파라미터가 필요합니다.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    const doc = DocumentApp.openById(docId);
    const body = doc.getBody().getText();
    return ContentService.createTextOutput(JSON.stringify({ content: body }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
