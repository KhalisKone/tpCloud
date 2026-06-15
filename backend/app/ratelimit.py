"""Rate limiting partagé.

Protège notamment /predict contre le model stealing : un attaquant qui veut
cloner le modèle doit envoyer des dizaines de milliers de requêtes. En plafonnant
le débit par IP, on rend l'attaque beaucoup plus lente et détectable.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
