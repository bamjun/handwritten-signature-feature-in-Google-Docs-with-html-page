function onOpen() {
  DocumentApp.getUi()
    .createMenu('커스텀 메뉴')
    .addItem('HTML로 열기', 'openAsHTML')
    .addItem('그리기 시작', 'startDrawing')
    .addItem('초기화', 'initializeImages') // 초기화 버튼 추가
    .addItem('서명 목록 보기', 'showImageTitles') // 이미지 타이틀 보기 메뉴 추가
    .addToUi();

  showImageTitles();
}

function showImageTitles() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var imageTitles = getAllImageTitles(body);

  // HTML 출력 생성
  var htmlContent = "<h3>작성 목록</h3><ul>";
  imageTitles.forEach(function(title, index) {
    // 클릭 가능한 링크로 변경하고 onclick 이벤트 추가
    htmlContent += "<li><a href='#' onclick='google.script.run.startDrawingByImageTitle(\"" + title + "\"); return false;'>" +
                  title + "</a></li>";
  });
  htmlContent += "</ul>";

  // 사이드바에 표시
  var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setTitle('작성 목록')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  DocumentApp.getUi().showSidebar(htmlOutput);
}

function getAllImageTitles(container) {
  var numChildren = container.getNumChildren();
  var titles = [];

  // 컨테이너가 Body인 경우 getParagraphs()로 모든 단락 확인
  if (container.getParagraphs) {
    var paragraphs = container.getParagraphs();
    for (var p = 0; p < paragraphs.length; p++) {
      var paragraph = paragraphs[p];
      var elements = paragraph.getNumChildren();
      
      for (var e = 0; e < elements; e++) {
        var element = paragraph.getChild(e);
        if (element.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
          if (title = element.getAltTitle()) {
            titles.push(title);
          }
        }
      }
    }
  }

  // 기존 로직 유지
  for (var i = 0; i < numChildren; i++) {
    var child = container.getChild(i);

    if (child.getType() === DocumentApp.ElementType.INLINE_IMAGE || 
        child.getType() === DocumentApp.ElementType.POSITIONED_IMAGE) {
          if (title = child.getAltTitle()) {
            titles.push(title);
          }      
    } else if (child.getNumChildren && child.getNumChildren() > 0) {
      titles = titles.concat(getAllImageTitles(child));
    }
  }
  
  // 중복 제거
  return [...new Set(titles)];
}


function initializeImages() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  
  // 빈 캔버스 생성 및 Blob 변환
  var blob = createEmptyCanvasBlob();
  if (!blob) {
    DocumentApp.getUi().alert('빈 캔버스 생성에 실패했습니다.');
    return;
  }
  
  // 모든 이미지 타이틀 가져오기
  var imageTitles = getAllImageTitles(body);
  
  // 각 타이틀에 대해 이미지 교체 실행
  imageTitles.forEach(function(title) {
    replaceImagesByTitle(body, title, blob);
  });
}

function createEmptyCanvasBlob() {
  // 10x10 크기의 빈 흰색 이미지의 base64 데이터
  const scriptProperties = PropertiesService.getScriptProperties();
  var base64Data = scriptProperties.getProperty("blue-blob");
  return Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/png', 'empty.png');
}

function replaceImagesByTitle(container, targetTitle, blob) {
  var numChildren = container.getNumChildren();

  for (var i = 0; i < numChildren; i++) {
    var child = container.getChild(i);

    if (child.getType() === DocumentApp.ElementType.INLINE_IMAGE || 
        child.getType() === DocumentApp.ElementType.POSITIONED_IMAGE) {
      var childTitle = child.getAltTitle();
      
      if (childTitle === targetTitle) {
        // 원래 이미지의 너비와 높이 가져오기
        var originalWidth = child.getWidth();
        var originalHeight = child.getHeight();

        // 새로운 "init" 이미지 삽입
        var parent = child.getParent();
        var insertedImage;
        if (child.getType() === DocumentApp.ElementType.POSITIONED_IMAGE) {
          insertedImage = parent.insertPositionedImage(parent.getChildIndex(child), blob);
        } else {
          insertedImage = parent.insertInlineImage(parent.getChildIndex(child), blob);
        }

        // 삽입된 이미지 크기와 타이틀 설정
        insertedImage.setWidth(originalWidth);
        insertedImage.setHeight(originalHeight);
        insertedImage.setAltTitle(targetTitle);

        // 기존 이미지 제거
        parent.removeChild(child);
      }
    } else if (child.getNumChildren && child.getNumChildren() > 0) {
      replaceImagesByTitle(child, targetTitle, blob); // 하위 요소에서 재귀적으로 탐색
    }
  }
}

function findImageByTitle(container, targetTitle) {
  // 문서 내에서 특정 타이틀을 가진 이미지 요소를 찾음
  var numChildren = container.getNumChildren();
  for (var i = 0; i < numChildren; i++) {
    var child = container.getChild(i);
    if (child.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      if (child.getAltTitle() === targetTitle) {
        return child; // 대상 타이틀을 가진 이미지 요소 반환
      }
    } else if (child.getNumChildren && child.getNumChildren() > 0) {
      var result = findImageByTitle(child, targetTitle);
      if (result) {
        return result;
      }
    }
  }
  return null;
}

function startDrawingByImageTitle(imageTitle) {
  PropertiesService.getDocumentProperties().setProperty('imageTitle', imageTitle);

  var html = HtmlService.createHtmlOutputFromFile('DrawDialog')
    .setWidth(600)
    .setHeight(400);
  DocumentApp.getUi().showModalDialog(html, '그리기');
}



function startDrawing() {
  var doc = DocumentApp.getActiveDocument();
  var selection = doc.getSelection();

  if (selection) {
    var elements = selection.getRangeElements();
    if (elements.length === 1 && elements[0].getElement().getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      var imageElement = elements[0].getElement(); // 선택한 이미지 요소
      var imageTitle = imageElement.getAltTitle(); // 이미지 제목
      PropertiesService.getDocumentProperties().setProperty('imageTitle', imageTitle);

      var html = HtmlService.createHtmlOutputFromFile('DrawDialog')
        .setWidth(600)
        .setHeight(400);
      DocumentApp.getUi().showModalDialog(html, '그리기');
    } else {
      DocumentApp.getUi().alert('이미지를 선택해주세요.');
    }
  } else {
    DocumentApp.getUi().alert('이미지를 선택해주세요.');
  }
}

function replaceImage(imageData) {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var imageTitle = PropertiesService.getDocumentProperties().getProperty('imageTitle');

  if (imageTitle) {
    var searchResult = findImageElementByTitle(body, imageTitle);
    if (searchResult) {
      var blob = Utilities.newBlob(Utilities.base64Decode(imageData), 'image/png', 'drawing.png');
      var parent = searchResult.getParent();
      var insertedImage = parent.insertInlineImage(parent.getChildIndex(searchResult), blob);

      // 원래 이미지의 너비와 높이 가져오기
      var originalWidth = searchResult.getWidth();
      var originalHeight = searchResult.getHeight();
      var originalTitle = searchResult.getAltTitle();

      // 새로운 이미지의 크기와 타이틀 설정
      insertedImage.setWidth(originalWidth);
      insertedImage.setHeight(originalHeight);
      insertedImage.setAltTitle(originalTitle);

      // 기존 이미지 제거
      parent.removeChild(searchResult);

      // **이미지 타이틀 반환**
      return imageTitle;
    } else {
      DocumentApp.getUi().alert('이미지를 찾을 수 없습니다.');
    }
  } else {
    DocumentApp.getUi().alert('이미지 제목 정보를 찾을 수 없습니다.');
  }
}



function findImageElementByTitle(container, targetTitle) {
  var numChildren = container.getNumChildren();

  for (var i = 0; i < numChildren; i++) {
    var child = container.getChild(i);

    if (child.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      var childTitle = child.getAltTitle();
      if (childTitle === targetTitle) {
        return child;
      }
    } else if (child.getNumChildren && child.getNumChildren() > 0) {
      var result = findImageElementByTitle(child, targetTitle);
      if (result) {
        return result;
      }
    }
  }
  return null;
}


function openAsHTML() {
  var doc = DocumentApp.getActiveDocument();
  var docId = doc.getId();

  // Google Docs에서 이미지 정보 수집
  var imageTitles = getImageTitlesWithIndex(doc);

  // 문서를 HTML로 내보내기
  var url = 'https://docs.google.com/feeds/download/documents/export/Export?id=' + docId + '&exportFormat=html';

  var params = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, params);
  var htmlContent = response.getContentText();

  // HTML 콘텐츠에서 이미지 태그에 alt 속성 추가
  htmlContent = addAltAttributesToImages(htmlContent, imageTitles);

  // 클라이언트 사이드 스크립트 추가
  var script = '<script>' +
    'function addImageClickHandlers() {' +
    '  var imgs = document.getElementsByTagName("img");' +
    '  for (var i = 0; i < imgs.length; i++) {' +
    '    imgs[i].onclick = function() {' +
    '      var altTitle = this.getAttribute("alt");' +
    '      if (altTitle) {' +
    '        google.script.run.startDrawingByImageTitle(altTitle);' +
    '      } else {' +
    '        alert("이미지에 타이틀이 없습니다.");' +
    '      }' +
    '    };' +
    '  }' +
    '}' +
    'function checkForUpdates() {' +
    '  google.script.run.withSuccessHandler(function(updated) {' +
    '    if (updated) {' +
    '      location.reload();' +
    '    }' +
    '  }).checkForImageUpdate();' +
    '}' +
    'window.onload = function() {' +
    '  addImageClickHandlers();' +
    '  setInterval(checkForUpdates, 5000);' + // 5초마다 업데이트 확인
    '};' +
    '</script>';

  // 스크립트를 HTML 콘텐츠의 </body> 태그 전에 삽입
  htmlContent = htmlContent.replace('</body>', script + '</body>');

  var htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(800)
    .setHeight(600)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME); // Sandbox 모드 설정

  DocumentApp.getUi().showModelessDialog(htmlOutput, '문서의 HTML 보기');
}


function getImageTitlesWithIndex(doc) {
  var body = doc.getBody();
  var images = [];
  var totalImages = 0;

  function recursiveGetImages(element) {
    var numChildren = element.getNumChildren ? element.getNumChildren() : 0;
    for (var i = 0; i < numChildren; i++) {
      var child = element.getChild(i);
      var type = child.getType();

      if (type == DocumentApp.ElementType.INLINE_IMAGE) {
        var altTitle = child.getAltTitle();
        images.push({
          index: totalImages,
          altTitle: altTitle || ''
        });
        totalImages++;
      } else if (child.getNumChildren && child.getNumChildren() > 0) {
        recursiveGetImages(child);
      }
    }
  }

  recursiveGetImages(body);
  return images;
}

function addAltAttributesToImages(htmlContent, imageTitles) {
  // 정규식을 사용하여 모든 <img> 태그를 찾음
  var imgTagRegex = /<img [^>]*>/g;
  var imgTags = htmlContent.match(imgTagRegex);

  if (!imgTags) {
    return htmlContent;
  }

  for (var i = 0; i < imgTags.length; i++) {
    var imgTag = imgTags[i];
    var altTitle = imageTitles[i] ? imageTitles[i].altTitle : '';
    var newImgTag = imgTag;

    // alt 속성을 추가 또는 수정
    if (imgTag.indexOf('alt=') > -1) {
      newImgTag = newImgTag.replace(/alt="[^"]*"/, 'alt="' + altTitle + '"');
    } else {
      newImgTag = newImgTag.replace('<img ', '<img alt="' + altTitle + '" ');
    }

    // id 속성 추가
    newImgTag = newImgTag.replace('<img ', '<img id="img_' + i + '" ');

    // 기존 img 태그를 새로운 태그로 교체
    htmlContent = htmlContent.replace(imgTag, newImgTag);
  }
  return htmlContent;
}



function checkForImageUpdate() {
  var properties = PropertiesService.getDocumentProperties();
  var imageUpdated = properties.getProperty('imageUpdated');

  if (imageUpdated === 'true') {
    // 업데이트 신호를 다시 false로 설정
    properties.setProperty('imageUpdated', 'false');
    return true;
  }
  return false;
}


function notifyImageUpdated(imageTitle) {
  return imageTitle;
}
