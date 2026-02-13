import secrets

tokens = [secrets.token_hex(32) for _ in range(3)]

with open("secrets.txt", "w") as f:
    for t in tokens:
        f.write(t + "\n")

print("Secrets written to secrets.txt")
