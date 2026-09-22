from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginAPIView, RegisterView, ListUser, MeView, ListRoles

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginAPIView.as_view(), name="login"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", ListUser.as_view(), name="list-users"),
    path("roles/", ListRoles.as_view(), name="list-roles"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
]
