
$(function() {

  // HEY CHECK OUT THIS GLOBAL!!!!!!
  var picksData = {};

  String.prototype.interpolate = function(dict) {
      return this.replace(/\$\{(\w+)\}/g, function(match, key) {
          return dict[key];
      });
  };

  function hideDialog() {
    $('#dialog').hide();
  }

  function showDialog(message, dialogClass, delay, callback) {
    var $dialog = $('#dialog')
    var $inner = $dialog.find('div')
    var calledBack = false;
    $dialog.off('click')
    $inner.html(message)
    $inner.toggleClass(dialogClass)
    $dialog.show()
    function onClick() {
      if (calledBack) { return } // ensure we only run once, by click or timer
      hideDialog()
      $inner.toggleClass(dialogClass)
      callback && callback()
      calledBack = true
    }
    $dialog.on('click', onClick)
    setTimeout(onClick, delay)
  }

  // Call this just the one time on page load, to convert wiki page data to JSON in memory
  function loadData() {
    picksData = {
      num: 0,
    }
    return $.getJSON(location.pathname)
      .done(function(response) {
        var season = response.name
        picksData.season = season
        picksData.admin = response.admin
        picksData.pickers = response.pickers
        picksData.weeks = response.weeks
        var idx = 0
        response.weeks.map(function(week) {
          var name = week.name
          var label = week.name.replace(/ /g, '_');
          week.label = label;
          week.title = name + ' - ' + season;
          week.scores = calcScoresForWeek(week);
          week.idx = idx++
          picksData[label] = week;
        });
        picksData.totals = calcScoresForSeason(picksData)
      })
      .fail(function(response) {
        if (response.responseJSON && response.responseJSON.error) {
          picksData.error = response.responseJSON.error
        }
      });
  }

  // make sure the back/forward buttons work
  window.onpopstate = function (event) {
    navigate(location.hash);
  }

  function getSeasonKey() {
    return picksData.season + '_Football_Picks';
  }

  // This gets called every time the location changes (both initial page load and subsequent single-page navigation) to render the appropriate data or redirect as necessary
  // We're assuming that the data on the page has already been loaded, and now we're SPA-ing
  function navigate(hash) {
    var params = hash.split('#');
    var seasonKey = getSeasonKey();
    if (params.length != 2 || params[1] === '_=_') {
      return redirectTo('#' + seasonKey);
    }
    // return false
    var key = params[1];
    if (key == seasonKey) {
      window.scroll(0,0);
      return renderSeasonOverview();
    }
    var data = picksData[key];
    if (data && data.id) {
      window.scroll(0,0);
      return spRender(data);
    }
    return errorRender(data);
  }

  // Replace the current state with a new one (back button won't undo this)
  function redirectTo(path) {
    history.replaceState({}, '', path);
    navigate(path);
  }

  // Add a new state (back button will undo this)
  function navigateTo(path) {
    history.pushState({}, '', path);
    navigate(path);
  }
  
  function errorRender(data) {
    showDialog(data || 'Something bad happened', 'error', 15000, function() { window.location = '/' })
  }

  function spRender(data, $target) {
    var $_target = $target || $('#view');
    picksData.num = data.id
    if (canSubmitPicks(data)) {
      $_target.html(renderPicksForm(data));
      var myPicks = data.picks.find(function(p) { return p.user === getUserId() });
      (myPicks && myPicks.picks || []).forEach(function (team) {
        _pick($('td#' + team.toLowerCase()))
      })
      $('button#submit').on('click', submitPicks)
      $('button#close').on('click', closeWeek)
    } else {
      $_target.html(renderResultsTable(data));
      $('button#winners').on('click', submitWinners)
    }
    highlightRequired($('#form'))
    $('td.pickable').on('click', function() { pick(this) });
    $('[data-target]').on('click', function() { navigateTo('#'+this.dataset.target); return false } )
    if (data.title) {
      document.title = data.title;
      $('#headline').text(data.title);
    }
    return data;
  }

  function canSubmitPicks(data) {
    // when a week is "closed", winners becomes ['TBD']
    return data.winners.length === 0
  }

  /* global nunjucks */
  // when run in DEBUG=0, templates are pre-loaded, so this has no effect
  nunjucks.configure('//' + location.host, {web: {useCache: true} })
  
  function renderSeasonOverview() {
    if (!picksData.weeks) return false;
    var names = picksData.pickers.map(getName);
    names.sort();
    var table = nunjucks.render('overview.html', { names: names, weeks: picksData.weeks, totals: picksData.totals});
    $('#view').html(table);
    $('[data-target]').on('click', function() { navigateTo('#'+this.dataset.target); return false } )
    document.title = 'Season Totals - ' + picksData.season;
    $('#headline').text('Season Totals - ' + picksData.season);
    return false
  }

  function renderPicksForm(theData) {
    return nunjucks.render('form.html', {
      week: theData,
      fAdmin: getUserId() === picksData.admin.id,
      prev: picksData.weeks[theData.idx - 1],
      home: { label: getSeasonKey(), name: "Season Totals" },
      next: picksData.weeks[theData.idx + 1],
    });
  }

  function renderResultsTable(theData) {
    theData.picks.sort(function (a,b) { return getName(a.user).localeCompare(getName(b.user)); });
    return nunjucks.render('results.html', {
      week: theData,
      names: theData.picks.map(function(a) { return getName(a.user) }),
      totals: picksData.totals,
      fAdmin: getUserId() === picksData.admin.id,
      prev: picksData.weeks[theData.idx - 1],
      home: { label: getSeasonKey(), name: "Season Totals" },
      next: picksData.weeks[theData.idx + 1],
    });
  }

  function calcScoresForSeason(season) {
    var scores = {};
    var names = season.pickers.map(function (user) { return getName(user); });
    season.weeks.forEach(function (week) {
      names.forEach(function (name) { scores[name] = (scores[name] || 0) + (week.scores[name] || 0); });
    });
    return scores;
  }

  function calcScoresForWeek(week) {
    var scores = {};
    week.picks.forEach(function (picks) {
      picks.score = calcScore(picks.picks, week.winners);
      scores[getName(picks.user)] = picks.score;
    });
    return scores;
  }

  function calcScore(picks, winners) {
    var score = 0;
    picks.forEach(function (pick) { if (winners.indexOf(pick) > -1 ) score++; });
    return score;
  }

  function pick(cell) {
    _pick(cell)
    $(cell).parent().removeClass('required');
    $('button[disabled]').prop('disabled', false);
  }
  function _pick(cell) {
    $(cell).addClass('picked');
    $(cell).siblings().removeClass('picked winner');
  }

  function submitPicks() {
    submit('picks')
  }
  function submitWinners() {
    submit('winners')
  }
  function submit(path) {
    var $form = $('table#form')
    $form.find('button').prop('disabled', true);
    try {
      doSubmit($form, path);
    } catch(err) {
      showDialog(
        'Nathan screwed up, please let him know<br>${message}'.interpolate(err),
        'error',
        60000);
    }
  }

  function highlightRequired(form) {
    var nPicks = form.find('.picked,.winner').length
    if (nPicks > 0 && nPicks < form.find('.game').length) {
      form.find('.game').each(function () {
        if ($(this).find('.picked,.winner').length < 1) $(this).addClass('required')
      });
      $('tr.warning').show();
    }
  }

  function getName(user) {
    var name;
    if (user && user.displayName) {
      name = user.displayName
    } else if (user && picksData.pickers) {
      picksData.pickers.forEach(function(picker) {
        if (picker.id === user) { name = picker.displayName }
      })
    } else if (window.user && window.user.displayName) {
      name = window.user.displayName
    }
    return name && name.split(' ')[0] || 'I have no idea :)';
  }

  function getUserId() {
    if (window.user && window.user.id) {
      return window.user.id
    }
    return 'I have no idea :)';
  }

  function getPicks(form) {
    return $(form).find('.picked,.winner').children('.team').map(function() { return this.textContent }).get();
  }

  function doSubmit(form, path) {
    var formData = {
      "picks": getPicks(form),
      "user": getUserId(),
    };
    $.ajax({
      type: "POST",
      url: "/week/${num}/${path}".interpolate({ num: picksData.num, path: path }),
      data: JSON.stringify(formData),
      success: function (data) {
        showDialog(data, 'success', 15000, reset)
      },
      error: function (jqxhr) {
        showDialog(jqxhr.responseText || 'Something bad happened', 'error', 15000, function() { navigate(location.hash) })
      },
      contentType: "application/json; charset=utf-8",
    })
  }
  
  function closeWeek() {
    $.post("/week/${num}/close".interpolate(picksData))
      .done(reset)
      .fail(function(err) { showDialog(err, 'error', 15000) })
  }
  
  function reset() {
    let $loading = $('.loading')
    $('#view').html('')
    $loading.show()
    loadData().then(function() { 
      navigate(location.hash)
    })
    .fail(() => navigate('#error'))
    .always(() => $loading.hide())
  }

  reset()  
})
