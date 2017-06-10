{ pkgs ? import <nixpkgs> {} }:
  with pkgs;
  stdenv.mkDerivation {
    name = "memory-fs";
    src = ./.;
    buildInputs = [ python2 nodejs nodePackages.node2nix ];
  }
