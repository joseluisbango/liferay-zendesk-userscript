/**
 * Add a sort button.
 */

function addSortButton(
  conversation: HTMLDivElement,
  header: HTMLElement,
) : void {

  var button = document.createElement('button');
  button.setAttribute('data-test-id', 'comment-sort');

  var sort = getCookieValue('_lesa-ui-comment-sort') || 'asc';

  button.textContent = sort;

  var conversationLog = <HTMLDivElement> conversation.querySelector('div[data-test-id="omni-log-container"]');

  var buttons = <HTMLElement> header.children[1];

  button.onclick = function() {
    if (conversationLog.style.flexDirection == 'column') {
      conversationLog.style.flexDirection = 'column-reverse';
      button.textContent = 'desc';
      document.cookie = '_lesa-ui-comment-sort=desc';
    }
    else {
      conversationLog.style.flexDirection = 'column';
      button.textContent = 'asc';
      document.cookie = '_lesa-ui-comment-sort=asc';
    }
  };

  buttons.prepend(button);
}

/**
 * Replaces the input field for the 'subject' with something with line wrapping
 * so that we can see the entire subject (untruncated).
 */

function addSubjectTextWrap(
  header: HTMLElement,
  ticketId: string,
  ticketInfo: TicketMetadata
) : void {

  var oldSubjectField = <HTMLInputElement> header.querySelector('input[data-test-id=ticket-pane-subject]');

  if (!oldSubjectField) {
    return;
  }

  oldSubjectField.setAttribute('type', 'hidden');

  var newSubjectField = header.querySelector('.lesa-ui-subject');

  if (newSubjectField) {
    if (newSubjectField.getAttribute('data-ticket-id') == ticketId) {
      return;
    }

    var parentElement = <HTMLElement> newSubjectField.parentElement;
    parentElement.removeChild(newSubjectField);
  }

  newSubjectField = document.createElement('div');

  var oldClassList = Array.from(oldSubjectField.classList);

  for (var i = 0; i < oldClassList.length; i++) {
    newSubjectField.classList.add(oldClassList[i]);
  }

  newSubjectField.textContent = oldSubjectField.value;

  if (!oldSubjectField.readOnly) {
    newSubjectField.setAttribute('contenteditable', 'true');

    newSubjectField.addEventListener('blur', function() {
      oldSubjectField.value = this.textContent || '';

      var event = document.createEvent('HTMLEvents');
      event.initEvent('blur', false, true);
      oldSubjectField.dispatchEvent(event);
    });
  }

  newSubjectField.classList.add('lesa-ui-subject');
  newSubjectField.setAttribute('data-ticket-id', ticketId);

  var parentElement = <HTMLElement> oldSubjectField.parentElement;
  parentElement.insertBefore(newSubjectField, oldSubjectField);
}

/**
 * Generate a knowledge capture container.
 */

function createKnowledgeCaptureContainer(
  ticketId: string,
  ticketInfo: TicketMetadata,
  conversation: HTMLDivElement
) : HTMLDivElement | null {

  var fastTrackList = document.createElement('ul');

  if (ticketInfo.audits) {
    var knowledgeCaptureEvents = ticketInfo.audits.map(function(x) {
      return x.events.filter(function(x) {
        return x.type == 'KnowledgeCaptured';
      });
    }).reduce(function(array, x) {
      return array.concat(x);
    }, []);

    fastTrackList = knowledgeCaptureEvents.reduce(function(list, x) {
      var item = document.createElement('li');
      item.appendChild(createAnchorTag(x.body.article.title, x.body.article.html_url));
      list.appendChild(item);
      return list;
    }, fastTrackList);
  }

  var otherArticleList = document.createElement('ul');

  Array.from(conversation.querySelectorAll('a[href*="/hc/"]')).reduce(function(list, x) {
    var item = document.createElement('li');
    item.appendChild(x.cloneNode(true));
    list.appendChild(item);
    return list;
  }, otherArticleList);

  if ((otherArticleList.childNodes.length == 0) && (fastTrackList.childNodes.length == 0)) {
    return null;
  }

  var knowledgeCaptureContainer = document.createElement('div');
  knowledgeCaptureContainer.classList.add('lesa-ui-knowledge-capture');

  if (fastTrackList.childNodes.length > 0) {
    var fastTrackLabel = document.createElement('div');
    fastTrackLabel.classList.add('lesa-ui-knowledge-capture-label');
    fastTrackLabel.innerHTML = (fastTrackList.childNodes.length == 1) ? 'Fast Track Article:' : 'Fast Track Articles:';

    knowledgeCaptureContainer.appendChild(fastTrackLabel);
    knowledgeCaptureContainer.appendChild(fastTrackList);
  }

  if (otherArticleList.childNodes.length > 0) {
    var otherArticleLabel = document.createElement('div');
    otherArticleLabel.classList.add('lesa-ui-knowledge-capture-label');
    otherArticleLabel.innerHTML = (otherArticleList.childNodes.length == 1) ? 'Other Linked Article:' : 'Other Linked Articles:';

    knowledgeCaptureContainer.appendChild(otherArticleLabel);
    knowledgeCaptureContainer.appendChild(otherArticleList);
  }

  return knowledgeCaptureContainer;
}

/**
 * Sometimes CSEs post a dummy comment, which basically says "see comment above this one"
 * in order to preserve formatting when creating child tickets.
 */

function isDummyComment(
  ticketInfo: TicketMetadata,
  comment: Element
) : boolean {

  var isChildTicket = false;
  var customFields = ticketInfo.ticket.custom_fields;

  for (var i = 0; i < customFields.length; i++) {
    var customField = customFields[i];

    if (customField.id != 360013377052) {
      continue;
    }

    if (customField.value && (customField.value.indexOf('child_of:') != -1)) {
      isChildTicket = true;
    }
  }

  if (!isChildTicket) {
    return false;
  }

  var innerHTML = comment.innerHTML;

  if (innerHTML != comment.textContent) {
    return false;
  }

  if ((innerHTML.indexOf('(to maintain formatting)') != -1) ||
    (innerHTML.indexOf('(to retain formatting)') != -1) ||
    (innerHTML.indexOf('formatted comment'))) {

    return true;
  }

  return false;
}

/**
 * Add a ticket description and a complete list of attachments to the top of the page.
 */

function addTicketDescription(
  ticketId: string,
  ticketInfo: TicketMetadata,
  conversation: HTMLDivElement
) : void {

  var header = <HTMLElement | null> null;

  if (isAgentWorkspace) {
    header = <HTMLElement> conversation.querySelector('div.omni-conversation-pane > div > div');
  }
  else {
    header = conversation.querySelector('.pane_header');
  }

  if (!header) {
    return;
  }

  // Check to see if we have any descriptions that we need to remove.

  if (isAgentWorkspace) {
    var oldLinks = conversation.querySelectorAll('.lesa-ui-modal-header-link');

    if (oldLinks.length > 0) {
      return;
    }
  }
  else {
    var oldDescriptions = conversation.querySelectorAll('.lesa-ui-description');

    var hasNewDescription = false;

    for (var i = 0; i < oldDescriptions.length; i++) {
      if (oldDescriptions[i].getAttribute('data-ticket-id') == ticketId) {
        hasNewDescription = true;
      }
      else {
        revokeObjectURLs();
        header.removeChild(oldDescriptions[i]);
      }
    }

    if (hasNewDescription) {
      return;
    }
  }

  // Add a marker indicating the LESA priority based on critical workflow rules

  addPriorityMarker(header, conversation, ticketId, ticketInfo);
  addSubjectTextWrap(header, ticketId, ticketInfo);

  // Generate something to hold all of our attachments.

  if (isAgentWorkspace) {
    addHeaderLinkModal('description-modal', 'Description', header, conversation, createDescriptionContainer.bind(null, ticketId, ticketInfo, conversation));
    addHeaderLinkModal('description-modal', 'Fast Track', header, conversation, createKnowledgeCaptureContainer.bind(null, ticketId, ticketInfo, conversation));
    addHeaderLinkModal('attachments-modal', 'Attachments', header, conversation, createAttachmentsContainer.bind(null, ticketId, ticketInfo, conversation));
    addSortButton(conversation, header);
  }
  else {
    var descriptionAncestor1 = document.createElement('div');
    descriptionAncestor1.classList.add('lesa-ui-description');
    descriptionAncestor1.classList.add('rich_text');
    descriptionAncestor1.setAttribute('data-ticket-id', ticketId);

    var descriptionContainer = createDescriptionContainer(ticketId, ticketInfo, conversation);

    if (descriptionContainer) {
      descriptionAncestor1.appendChild(descriptionContainer);
    }

    var knowledgeCaptureContainer = createKnowledgeCaptureContainer(ticketId, ticketInfo, conversation);

    if (knowledgeCaptureContainer) {
      descriptionAncestor1.appendChild(knowledgeCaptureContainer);
    }

    var attachmentsContainer = createAttachmentsContainer(ticketId, ticketInfo, conversation);

    if (attachmentsContainer) {
      descriptionAncestor1.appendChild(attachmentsContainer);
    }

    header.appendChild(descriptionAncestor1);
  }
}

function createDescriptionContainer(
  ticketId: string,
  ticketInfo: TicketMetadata,
  conversation: HTMLDivElement
) : HTMLDivElement | null {

  var showMoreButton = <HTMLButtonElement | null>document.querySelector('button[data-test-id="convolog-show-more-button"]');

  if (showMoreButton) {
    showMoreButton.click();

    return null;
  }

  if (document.querySelector('[role="progressbar"]')) {
    return null;
  }

  var comments = conversation.querySelectorAll(isAgentWorkspace ? 'article' : '.event .zd-comment');

  if (comments.length == 0) {
    return null;
  }

  var descriptionContainer = document.createElement('div');

  descriptionContainer.classList.add('is-public');

  if (!isAgentWorkspace) {
    descriptionContainer.classList.add('event');
  }

  var tags = (ticketInfo && ticketInfo.ticket && ticketInfo.ticket.tags) || [];
  var tagSet = new Set(tags);

  if (tagSet.has('partner_first_line_support')) {
    var flsContainer = document.createElement('div');

    flsContainer.classList.add('event');

    var flsReminder = document.createElement('div');
    flsReminder.classList.add('comment');

    flsReminder.appendChild(document.createTextNode('REMINDER: '));
    flsReminder.appendChild(document.createTextNode('Additional description, error logs, etc. collected by the partner are available in '));
    flsReminder.appendChild(getJiraSearchLink('the linked FLS ticket', ticketId));
    flsReminder.appendChild(document.createTextNode('.'));

    flsContainer.appendChild(flsReminder);

    descriptionContainer.appendChild(flsContainer);
  }

  var firstComment = comments[isAgentWorkspace ? 0 : comments.length - 1];

  if (isDummyComment(ticketInfo, firstComment)) {
    firstComment = comments[isAgentWorkspace ? 1 : comments.length - 2];
  }

  var description = document.createElement('div');

  description.classList.add('comment');
  description.classList.add('zd-comment');
  description.innerHTML = firstComment.innerHTML;

  descriptionContainer.appendChild(description);

  return descriptionContainer;
}