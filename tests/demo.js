// Documentation-only fixture. Production extension code performs the interaction.
setTimeout(()=>fetch('/i/api/graphql/test/UserByScreenName?variables='+encodeURIComponent(JSON.stringify({screen_name:'demo_profile'}))),100);
