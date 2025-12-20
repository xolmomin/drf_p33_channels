import pytest
from rest_framework.reverse import reverse_lazy


@pytest.mark.django_db
class TestUrl:

    def test_auth(self):
        url = reverse_lazy('send_code')
        assert '/api/v1/auth/send-code' == url
