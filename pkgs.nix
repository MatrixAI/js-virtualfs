import (
  # let rev = "00e56fbbee06088bf3bf82169032f5f5778588b7"
  let rev = "04a48a2fcd2370f4e8a8c9fd3394531ccdb30f1e"; in
  fetchTarball "https://github.com/MatrixAI/nixpkgs/archive/${rev}.tar.gz"
)
