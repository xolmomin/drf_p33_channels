mig:
	python3 manage.py makemigrations
	python3 manage.py migrate

loaddata:
	python3 manage.py loaddata users chats messages

front:
	python3 -m http.server 3000