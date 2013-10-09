var app = (function () {
	'use strict';

	// global error handling
	var showAlert = function(message, title, callback) {
		navigator.notification.alert(message, callback || function () {
		}, title, 'OK');
	};
	var showError = function(message) {
		showAlert(message, 'Error occured');
	};
	window.addEventListener('error', function (e) {
		e.preventDefault();
		var message = e.message + "' from " + e.filename + ":" + e.lineno;
		showAlert(message, 'Error occured');
		return true;
	});

	var onBackKeyDown = function(e) {
		e.preventDefault();
		navigator.notification.confirm('Do you really want to exit?', function (confirmed) {
			var exit = function () {
				navigator.app.exitApp();
			};
			if (confirmed === true || confirmed === 1) {
				AppHelper.logout().then(exit, exit);
			}
		}, 'Exit', 'Ok,Cancel');
	};
	var onDeviceReady = function() {
		//Handle document events
		document.addEventListener("backbutton", onBackKeyDown, false);
	};

	document.addEventListener("deviceready", onDeviceReady, false);

	var applicationSettings = {
		emptyGuid: '00000000-0000-0000-0000-000000000000',
		apiKey: 'RYklyrSaagKno0EE' //Put your API key here
	};

	// initialize Everlive SDK
	var el = new Everlive({
		apiKey: applicationSettings.apiKey
	});

	var facebook = new IdentityProvider({
		name: "Facebook",
		loginMethodName: "loginWithFacebook",
		endpoint: "https://www.facebook.com/dialog/oauth",
		response_type:"token",
		client_id: "{FACEBOOK_CLIENT_ID}", //Put your Facebook client id here
		redirect_uri:"https://www.facebook.com/connect/login_success.html",
		access_type:"online",
		scope:"email",
		display: "touch"
	});
    
	var AppHelper = {
		resolveProfilePictureUrl: function (id) {
			if (id && id !== applicationSettings.emptyGuid) {
				return el.Files.getDownloadUrl(id);
			}
			else {
				return 'styles/images/avatar.png';
			}
		},
		resolvePictureUrl: function (id) {
			if (id && id !== applicationSettings.emptyGuid) {
				return el.Files.getDownloadUrl(id);
			}
			else {
				return '';
			}
		},
		formatDate: function (dateString) {
			var date = new Date(dateString);
			var year = date.getFullYear().toString();
			var month = date.getMonth().toString();
			var day = date.getDate().toString();
			return day + '.' + month + '.' + year;
		},
		logout: function () {
			return el.Users.logout();
		}
	};

	var mobileApp = new kendo.mobile.Application(document.body, { transition: 'slide', layout: 'mobile-tabstrip' });

	var usersModel = (function () {
		var currentUser = kendo.observable({ data: null });
		var usersData;
		var loadUsers = function () {
			return el.Users.currentUser()
			.then(function (data) {
				var currentUserData = data.result;
				currentUserData.PictureUrl = AppHelper.resolveProfilePictureUrl(currentUserData.Picture);
				currentUser.set('data', currentUserData);
				return el.Users.get();
			})
			.then(function (data) {
				usersData = new kendo.data.ObservableArray(data.result);
			})
			.then(null,
				  function (err) {
					  showError(err.message);
				  }
			);
		};
		return {
			load: loadUsers,
			users: function () {
				return usersData;
			},
			currentUser: currentUser
		};
	}());

	// login view model
	var loginViewModel = (function () {
		var login = function () {
			var username = $('#loginUsername').val();
			var password = $('#loginPassword').val();

			el.Users.login(username, password)
			.then(function () {
				return usersModel.load();
			})
			.then(function () {
				mobileApp.navigate('views/carsView.html');
			})
			.then(null,
				  function (err) {
					  showError(err.message);
				  }
			);
		};
		var loginWithFacebook = function() {
			mobileApp.showLoading();
			facebook.getAccessToken(function(token) {
				el.Users.loginWithFacebook(token)
				.then(function () {
					return usersModel.load();
				})
				.then(function () {
					mobileApp.hideLoading();
					mobileApp.navigate('viewscarsView.html');
				})
				.then(null, function (err) {
					mobileApp.hideLoading();
					if (err.code = 214) {
                        showError("The specified identity provider is not enabled in the backend portal.");
					}
					else {
						showError(err.message);
					}
				});
			})
		} 
		return {
			login: login,
			loginWithFacebook: loginWithFacebook
		};
	}());

	// signup view model
	var singupViewModel = (function () {
		var dataSource;
		var signup = function () {
			dataSource.Gender = parseInt(dataSource.Gender);
			var birthDate = new Date(dataSource.BirthDate);
			if (birthDate.toJSON() === null)
				birthDate = new Date();
			dataSource.BirthDate = birthDate;
			Everlive.$.Users.register(
				dataSource.Username,
				dataSource.Password,
				dataSource)
			.then(function () {
				showAlert("Registration successful");
				mobileApp.navigate('#welcome');
			},
				  function (err) {
					  showError(err.message);
				  }
			);
		};
		var show = function () {
			dataSource = kendo.observable({
				Username: '',
				Password: '',
				DisplayName: '',
				Email: '',
				Gender: '1',
				About: '',
				Friends: [],
				BirthDate: new Date()
			});
			kendo.bind($('#signup-form'), dataSource, kendo.mobile.ui);
		};
		return {
			show: show,
			signup: signup
		};
	}());

	var carsModel = (function () {
		var carModel = {
			id: 'Id',
			fields: {
				Manufacturer: {
					field: 'Manufacturer',
					defaultValue: ''
				},
                Model: {
					field: 'Model',
					defaultValue: ''
				},
				ProductionDate: {
					field: 'ProductionDate',
					defaultValue: new Date()
				},
				IsVacant: {
					field: 'IsVacant',
					defaultValue: true
				},
                RentalPrice: {
                    field:'RentalPrice',
                    defaultValue:0
                }
			},
			ProductionDateFormatted: function () {
				return AppHelper.formatDate(this.get('ProductionDate'));
			}
		};
		var carsDataSource = new kendo.data.DataSource({
			type: 'everlive',
			schema: {
				model: carModel
			},
			transport: {
				// required by Everlive
				typeName: 'Car'
			},
			change: function (e) {
				if (e.items && e.items.length > 0) {
					$('#no-activities-span').hide();
				}
				else {
					$('#no-activities-span').show();
				}
			},
			sort: { field: 'ProductionDate', dir: 'desc' }
		});
		return {
			cars: carsDataSource
		};
	}());

	// cars view model
	var carsViewModel = (function () {
		var carSelected = function (e) {
			mobileApp.navigate('views/carView.html?uid=' + e.data.uid);
		};
		var navigateHome = function () {
			mobileApp.navigate('#welcome');
		};
		var logout = function () {
			AppHelper.logout()
			.then(navigateHome, function (err) {
				showError(err.message);
				navigateHome();
			});
		};
		return {
			cars: carsModel.cars,
			carSelected: carSelected,
			logout: logout
		};
	}());

	// car details view model
	var carViewModel = (function () {
		return {
			show: function (e) {
				var car = carsModel.cars.getByUid(e.view.params.uid);
				kendo.bind(e.view.element, car, kendo.mobile.ui);
			}
		};
	}());

    var rentalsModel = (function () {
		var rentalModel = {
			id: 'Id',
			fields: {
				/*Car: {
					field: 'Car',
					defaultValue: new Car()
				},*/
				StartDate: {
					field: 'StartDate',
					defaultValue: new Date()
				},
				EndDate: {
					field: 'StartEndDateate',
					defaultValue: new Date()
				}
			},
			StartDateFormatted: function () {
				return AppHelper.formatDate(this.get('StartDate'));
			},
			EndDateFormatted: function () {
				return AppHelper.formatDate(this.get('EndDate'));
			}
		};
		var rentalsDataSource = new kendo.data.DataSource({
			type: 'everlive',
			schema: {
				model: rentalModel
			},
			transport: {
				// required by Everlive
				typeName: 'Rentals'
			},
			change: function (e) {
				if (e.items && e.items.length > 0) {
					$('#no-activities-span').hide();
				}
				else {
					$('#no-activities-span').show();
				}
			}
		});
		return {
			rentals: rentalsDataSource
		};
	}());
    
	// reserve car view model
	var rentalsViewModel = (function () {
		var rentalSelected = function (e) {
			mobileApp.navigate('views/rentalView.html?uid=' + e.data.uid);
		};
		var navigateHome = function () {
			mobileApp.navigate('#welcome');
		};
		var logout = function () {
			AppHelper.logout()
			.then(navigateHome, function (err) {
				showError(err.message);
				navigateHome();
			});
		};
		return {
			rentals: rentalsModel.rentals,
			rentalSelected: rentalSelected,
			logout: logout
		};
	}());
    
    var rentalViewModel = (function () {
		return {
			show: function (e) {
				var car = rentalsModel.rentals.getByUid(e.view.params.uid);
				kendo.bind(e.view.element, car, kendo.mobile.ui);
			}
		};
	}());

	return {
		viewModels: {
			login: loginViewModel,
			signup: singupViewModel,
			cars: carsViewModel,
			car: carViewModel,
            rentals:rentalsViewModel,
			rental: rentalViewModel
		}
	};
}());